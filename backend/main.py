"""
Intelli IPS — Main Application
FastAPI backend that orchestrates the IoT network simulation, IPS detection engine,
and exposes REST + SSE APIs for the Electron frontend.

Author: A AlNabgha
Project: AI-Driven Intrusion Prevention System for IoT Networks
"""

import asyncio
import time
import logging
import uuid
import platform
import socket
import re
import random
import subprocess
import concurrent.futures
from typing import Optional
from datetime import datetime
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import (
    SIMULATION_TICK_INTERVAL, API_HOST, API_PORT,
    CORS_ORIGINS, MAX_TRAFFIC_HISTORY,
)
from simulation.network import IoTNetwork
from simulation.traffic import generate_traffic_batch
from simulation.attacks import AttackSimulator
from engine.detector import DetectionEngine
from engine.mitigator import Mitigator
from models.schemas import Alert, LogEntry, ChartDataPoint, RiskLevel, ActionTaken, DetectionMethod

# ──────────────────────────────────────────────
# Logging Configuration
# ──────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s │ %(name)-28s │ %(levelname)-8s │ %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("intelli_ips.main")

# ──────────────────────────────────────────────
# Real IoT Network Helper Functions
# ──────────────────────────────────────────────
def get_local_ip() -> str:
    """Get the local IP of this machine."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('10.255.255.255', 1))
        IP = s.getsockname()[0]
    except Exception:
        IP = '127.0.0.1'
    finally:
        s.close()
    return IP

def run_ping_latency_sync(ip: str) -> Optional[float]:
    cmd = ["ping", "-n", "1", "-w", "400", ip] if platform.system() == "Windows" else ["ping", "-c", "1", "-W", "1", ip]
    start_time = time.time()
    try:
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, errors="ignore")
        elapsed = (time.time() - start_time) * 1000.0
        if res.returncode == 0:
            match = re.search(r'time[=<]([\d\.]+)ms', res.stdout)
            if match:
                return float(match.group(1))
            return round(elapsed, 1)
        return None
    except Exception:
        return None

async def ping_device_latency(ip: str) -> Optional[float]:
    """Ping an IP address and return round-trip latency in milliseconds, or None if timeout."""
    local_ip = get_local_ip()
    if ip == local_ip or ip == '127.0.0.1':
        return 1.2
    
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, run_ping_latency_sync, ip)

def run_ping_sync(ip: str):
    cmd = ["ping", "-n", "1", "-w", "100", ip] if platform.system() == "Windows" else ["ping", "-c", "1", "-W", "1", ip]
    try:
        subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except Exception:
        pass

def run_arp_sync() -> str:
    try:
        res = subprocess.run(["arp", "-a"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, errors="ignore")
        return res.stdout
    except Exception:
        return ""

async def scan_local_network():
    """Scans the local subnet using ping sweeps and ARP cache parsing in thread pools."""
    local_ip = get_local_ip()
    if local_ip == '127.0.0.1':
        return []

    parts = local_ip.split('.')
    if len(parts) != 4:
        return []
    subnet_prefix = f"{parts[0]}.{parts[1]}.{parts[2]}."

    loop = asyncio.get_running_loop()
    with concurrent.futures.ThreadPoolExecutor(max_workers=25) as executor:
        futures = [
            loop.run_in_executor(executor, run_ping_sync, f"{subnet_prefix}{i}")
            for i in range(1, 51)
        ]
        futures.append(loop.run_in_executor(executor, run_ping_sync, f"{subnet_prefix}254"))
        await asyncio.gather(*futures)

    output = await loop.run_in_executor(None, run_arp_sync)

    discovered = []
    ip_mac_pattern = re.compile(
        r'(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\s+([0-9a-fA-F:-]{17})'
    )

    for line in output.split('\n'):
        match = ip_mac_pattern.search(line)
        if match:
            ip_addr = match.group(1)
            mac_addr = match.group(2).replace('-', ':').upper()
            
            if ip_addr.startswith(subnet_prefix) and ip_addr != local_ip:
                last_octet = int(ip_addr.split('.')[-1])
                dev_id = f"REAL_{last_octet}"
                
                if last_octet == 1:
                    name = "Local_Router_Gateway"
                    dev_type = "router"
                elif last_octet in [100, 101, 102]:
                    name = f"Smart_Speaker_{last_octet}"
                    dev_type = "speaker"
                elif last_octet in [105, 106, 110]:
                    name = f"IP_Camera_{last_octet}"
                    dev_type = "videocam"
                else:
                    name = f"IoT_Device_{last_octet}"
                    dev_type = "sensors"

                discovered.append({
                    "id": dev_id,
                    "name": name,
                    "type": dev_type,
                    "ip": ip_addr,
                    "mac": mac_addr,
                    "protocol": "MQTT" if dev_type == "sensors" else "CoAP" if dev_type == "speaker" else "HTTP",
                    "status": "online",
                    "allowed": True,
                    "is_real": True
                })

    discovered.append({
        "id": "REAL_HOST",
        "name": f"Operator_Console ({platform.node()})",
        "type": "precision_manufacturing",
        "ip": local_ip,
        "mac": "AA:BB:CC:DD:EE:FF",
        "protocol": "HTTP",
        "status": "online",
        "allowed": True,
        "is_real": True
    })

    return discovered

# ──────────────────────────────────────────────
# Shared Application State
# ──────────────────────────────────────────────
network = IoTNetwork()
attack_simulator = AttackSimulator()
detector = DetectionEngine()
mitigator = Mitigator(network)

app_state = {
    "running": False,
    "network": network,
    "attack_simulator": attack_simulator,
    "detector": detector,
    "mitigator": mitigator,
    "alerts": [],               # list[Alert]
    "logs": [],                 # list[LogEntry]
    "total_packets": 0,
    "uptime": 0.0,
    "pps": 0.0,                 # packets per second
    "traffic_chart": [],        # list[ChartDataPoint]
    "sim_task": None,
    "start_time": None,
    "baseline_trained": False,
    "mode": "simulation",       # "simulation" or "real"
    "real_scanner_running": False,
}


# ──────────────────────────────────────────────
# Simulation Loop
# ──────────────────────────────────────────────
async def simulation_loop():
    """
    Core simulation loop that runs every tick:
      1. Generate normal traffic from all active devices
      2. If attack is active, inject malicious traffic
      3. Run all packets through the IPS detection engine
      4. Execute mitigation for any detected threats
      5. Update metrics and traffic chart
    """
    state = app_state
    state["start_time"] = time.time()
    tick = 0
    baseline_packets = []

    logger.info("═══ Simulation Started ═══")

    # Generate initial system log
    state["logs"].append(LogEntry(
        id=f"LOG-{uuid.uuid4().hex[:8]}",
        timestamp=datetime.now().strftime("%H:%M:%S"),
        source="CORE",
        category="SYSTEM",
        message="Intelli IPS Simulation Engine initialized. All subsystems nominal.",
        status="SUCCESS",
    ))

    try:
        while state["running"]:
            tick_start = time.time()
            tick += 1

            # ─── 1. Generate normal traffic and pings ────
            if state["mode"] == "real":
                # Monitor active real devices
                real_monitored_devices = [
                    d for d in state["network"].devices.values()
                    if d["id"] != "GW_01" and d.get("ip")
                ]

                async def check_device(dev):
                    # Skip pinging quarantined devices to avoid updating their online status
                    if dev["id"] in state["network"].quarantined_devices:
                        return dev, None
                    ip = dev["ip"]
                    latency = await ping_device_latency(ip)
                    return dev, latency

                results = await asyncio.gather(*[check_device(d) for d in real_monitored_devices])

                normal_packets = []
                for dev, latency in results:
                    dev_id = dev["id"]
                    if dev_id in state["network"].quarantined_devices:
                        continue
                        
                    if latency is not None:
                        # Device is responding
                        if dev["status"] == "blocked":
                            state["network"].unquarantine_device(dev_id)
                        
                        # Generate some packets where the payload acts as latency context
                        pkt_count = random.randint(1, 4)
                        for _ in range(pkt_count):
                            from models.schemas import TrafficPacket
                            pkt = TrafficPacket(
                                id=f"PKT-{uuid.uuid4().hex[:8].upper()}",
                                timestamp=datetime.now(),
                                source_ip=dev["ip"],
                                source_device_id=dev_id,
                                destination_ip="192.168.1.1",
                                protocol=dev.get("protocol", "MQTT"),
                                payload_size=random.randint(10, 50),
                                packet_type="DATA",
                                sensor_value=latency, # Map real ping latency as sensor value
                                is_malicious=False
                            )
                            normal_packets.append(pkt)
                    else:
                        # Ping timeout! Quarantine it and raise an alert
                        if dev_id not in state["network"].quarantined_devices:
                            state["network"].quarantine_device(dev_id)
                            alert = Alert(
                                id=f"ALT-{uuid.uuid4().hex[:6].upper()}",
                                risk=RiskLevel.CRITICAL,
                                timestamp=datetime.now().strftime("%H:%M:%S"),
                                device=dev["name"],
                                deviceId=dev_id,
                                threat="Device Link Loss / Connection Failure",
                                assessment="Ping Timeout",
                                confidence=100,
                                description=f"Device {dev['name']} ({dev['ip']}) failed to respond to health checks. Automatically quarantined.",
                                tags=["Link Failure", "Offline", "Ping Timeout"],
                                actionTaken=ActionTaken.BLOCKED,
                                detectionMethod=DetectionMethod.SIGNATURE,
                                source_ip=dev["ip"]
                            )
                            state["alerts"].append(alert)
                            state["logs"].append(LogEntry(
                                id=f"LOG-{uuid.uuid4().hex[:8]}",
                                timestamp=datetime.now().strftime("%H:%M:%S"),
                                source=dev_id,
                                category="MITIGATION",
                                message=f"Device {dev['name']} isolated: Link loss detected (ping timeout).",
                                status="BLOCKED"
                            ))
                attack_packets = []
            else:
                active_devices = state["network"].get_active_devices()
                normal_packets = generate_traffic_batch(active_devices)

                # ─── 2. Generate attack traffic (if active) ──
                attack_active_before = state["attack_simulator"].is_active()
                attack_packets = state["attack_simulator"].generate_attack_traffic()
                attack_active_after = state["attack_simulator"].is_active()

                if attack_active_after:
                    target_dev = state["attack_simulator"].target_device
                    if target_dev:
                        state["network"].set_device_threat(target_dev["id"])
                    attacker_dev = state["attack_simulator"].attacker_device
                    if attacker_dev:
                        state["network"].set_device_threat(attacker_dev["id"])
                elif attack_active_before:
                    # Attack naturally completed. Clear threat state of non-quarantined devices.
                    for dev_id in list(state["network"].devices.keys()):
                        state["network"].clear_device_threat(dev_id)
            all_packets = normal_packets + attack_packets
            state["total_packets"] += len(all_packets)

            # ─── 3. Baseline ML training phase ───────────
            # For the first N ticks, collect normal traffic to train the ML model
            if not state["baseline_trained"] and tick <= 10:
                baseline_packets.extend(normal_packets)
                if tick == 10:
                    # Train the ML model on baseline data
                    baselines = {
                        d["id"]: d.get("normal_packet_rate", 5)
                        for d in state["network"].devices.values()
                    }
                    state["detector"].train_ml_model(baseline_packets, baselines)
                    state["baseline_trained"] = True
                    state["logs"].append(LogEntry(
                        id=f"LOG-{uuid.uuid4().hex[:8]}",
                        timestamp=datetime.now().strftime("%H:%M:%S"),
                        source="IPS_ENGINE",
                        category="SYSTEM",
                        message=f"ML Anomaly Model trained on {len(baseline_packets)} baseline samples. Isolation Forest active.",
                        status="SUCCESS",
                    ))
                    logger.info(f"ML model trained on {len(baseline_packets)} baseline packets")

            # ─── 4. Run IPS Detection on all packets ─────
            for packet in all_packets:
                # Skip packets from blocked IPs
                if packet.source_ip in state["network"].blocked_ips:
                    continue

                # Skip packets from quarantined devices
                if packet.source_device_id in state["network"].quarantined_devices:
                    continue

                # Get device details and check if allowed (whitelist check)
                dev = state["network"].get_device(packet.source_device_id)
                if dev and not dev.get("allowed", True):
                    # Block it immediately!
                    state["network"].quarantine_device(packet.source_device_id)
                    if packet.source_ip:
                        state["network"].block_ip(packet.source_ip)
                    
                    alert = Alert(
                        id=f"ALT-{uuid.uuid4().hex[:6].upper()}",
                        risk=RiskLevel.CRITICAL,
                        timestamp=datetime.now().strftime("%H:%M:%S"),
                        device=dev["name"],
                        deviceId=packet.source_device_id,
                        threat="Unauthorized Device Detected",
                        assessment="Whitelist Fail",
                        confidence=100,
                        description=f"Device {dev['name']} ({packet.source_device_id}) is not on the whitelisted allowed devices list. Quarantined automatically.",
                        tags=["Security Policy", "Unauthorized Device"],
                        actionTaken=ActionTaken.BLOCKED,
                        detectionMethod=DetectionMethod.SIGNATURE,
                        source_ip=packet.source_ip,
                    )
                    state["alerts"].append(alert)
                    state["logs"].append(LogEntry(
                        id=f"LOG-{uuid.uuid4().hex[:8]}",
                        timestamp=datetime.now().strftime("%H:%M:%S"),
                        source=packet.source_device_id,
                        category="MITIGATION",
                        message=f"Device {dev['name']} isolated: Whitelist authentication failed.",
                        status="BLOCKED"
                    ))
                    
                    # Cap stored alerts/logs to prevent memory bloat
                    if len(state["alerts"]) > MAX_TRAFFIC_HISTORY:
                        state["alerts"] = state["alerts"][-MAX_TRAFFIC_HISTORY:]
                    if len(state["logs"]) > MAX_TRAFFIC_HISTORY:
                        state["logs"] = state["logs"][-MAX_TRAFFIC_HISTORY:]
                    continue

                baseline_rate = dev.get("normal_packet_rate", 5) if dev else 5

                # Inspect packet
                alert = state["detector"].inspect_packet(packet, baseline_rate)

                if alert:
                    # Resolve display name for dashboard
                    if alert.deviceId == "EXTERNAL":
                        alert.device = "External Attacker"
                    else:
                        dev_info = state["network"].get_device(alert.deviceId)
                        if dev_info:
                            alert.device = dev_info["name"]

                    # ─── 5. Execute Mitigation ────────────
                    mitigation_logs = state["mitigator"].mitigate(alert)
                    state["alerts"].append(alert)
                    state["logs"].extend(mitigation_logs)

                    # Cap stored alerts/logs to prevent memory bloat
                    if len(state["alerts"]) > MAX_TRAFFIC_HISTORY:
                        state["alerts"] = state["alerts"][-MAX_TRAFFIC_HISTORY:]
                    if len(state["logs"]) > MAX_TRAFFIC_HISTORY:
                        state["logs"] = state["logs"][-MAX_TRAFFIC_HISTORY:]

            # ─── 6. Update metrics ───────────────────────
            elapsed = time.time() - tick_start
            state["pps"] = round(len(all_packets) / max(elapsed, 0.001), 1)
            state["uptime"] = round(time.time() - state["start_time"], 1)

            # Update traffic chart (rolling 24-point window)
            state["traffic_chart"].append(ChartDataPoint(
                time=datetime.now().strftime("%H:%M:%S"),
                value=len(all_packets),
            ))
            if len(state["traffic_chart"]) > 60:
                state["traffic_chart"] = state["traffic_chart"][-60:]

            # Generate periodic system log
            if tick % 10 == 0:
                state["logs"].append(LogEntry(
                    id=f"LOG-{uuid.uuid4().hex[:8]}",
                    timestamp=datetime.now().strftime("%H:%M:%S"),
                    source="GW_01",
                    category="NETWORK",
                    message=f"Tick {tick}: {len(all_packets)} packets processed | "
                            f"PPS: {state['pps']} | "
                            f"Alerts: {len(state['alerts'])} | "
                            f"Blocked IPs: {len(network.blocked_ips)}",
                    status="INFO",
                ))

            # Sleep until next tick
            sleep_time = max(0, SIMULATION_TICK_INTERVAL - elapsed)
            await asyncio.sleep(sleep_time)

    except asyncio.CancelledError:
        logger.info("═══ Simulation Stopped ═══")
    except Exception as e:
        logger.error(f"Simulation error: {e}", exc_info=True)
        state["running"] = False


# ──────────────────────────────────────────────
# FastAPI Application
# ──────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown lifecycle."""
    logger.info("╔══════════════════════════════════════════╗")
    logger.info("║   Intelli IPS Backend — Starting Up...   ║")
    logger.info("╚══════════════════════════════════════════╝")
    yield
    # Shutdown: stop simulation if running
    app_state["running"] = False
    if app_state.get("sim_task"):
        app_state["sim_task"].cancel()
    logger.info("Intelli IPS Backend shut down.")


app = FastAPI(
    title="Intelli IPS — AI-Driven IoT Intrusion Prevention System",
    description=(
        "Backend API for the Intelli IPS Intrusion Prevention System. "
        "Provides IoT network simulation, hybrid threat detection "
        "(Signature + Isolation Forest ML), and real-time prevention."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API Routers
from api.simulation_routes import router as sim_router
from api.ips_routes import router as ips_router
from api.device_routes import router as device_router
from api.auth_routes import router as auth_router

app.include_router(sim_router)
app.include_router(ips_router)
app.include_router(device_router)
app.include_router(auth_router)


# ──────────────────────────────────────────────
# Root Endpoint
# ──────────────────────────────────────────────
@app.get("/")
async def root():
    return {
        "name": "Intelli IPS Backend",
        "version": "1.0.0",
        "status": "operational",
        "simulation_running": app_state["running"],
        "docs": "/docs",
    }


# ──────────────────────────────────────────────
# Entry Point
# ──────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    import sys
    
    is_frozen = getattr(sys, 'frozen', False)
    
    if is_frozen:
        # Run with the app object directly and reload disabled for PyInstaller compatibility
        uvicorn.run(
            app,
            host=API_HOST,
            port=API_PORT,
            log_level="info",
        )
    else:
        # Development mode with live reloading
        uvicorn.run(
            "main:app",
            host=API_HOST,
            port=API_PORT,
            reload=True,
            log_level="info",
        )
