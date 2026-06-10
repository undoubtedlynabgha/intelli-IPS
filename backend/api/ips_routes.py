"""
Intelli IPS — IPS Engine API Routes
Endpoints for alerts, metrics, logs, and real-time event streaming (SSE).
"""

import json
import asyncio
from datetime import datetime
from fastapi import APIRouter, Query, Response
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from models.schemas import Alert, MetricsResponse, LogEntry, ChartDataPoint

router = APIRouter(prefix="/ips", tags=["IPS Engine"])


def get_app_state():
    from main import app_state
    return app_state


# ──────────────────────────────────────────────
# GET /ips/alerts
# ──────────────────────────────────────────────
@router.get("/alerts", response_model=list[Alert])
async def get_alerts(limit: int = Query(50, ge=1, le=500)):
    """Fetch the most recent IPS alerts."""
    state = get_app_state()
    alerts = state["alerts"][-limit:]
    alerts.reverse()  # newest first
    return alerts


# ──────────────────────────────────────────────
# GET /ips/alerts/stream (Server-Sent Events)
# ──────────────────────────────────────────────
@router.get("/alerts/stream")
async def stream_alerts():
    """
    Real-time alert stream using Server-Sent Events (SSE).
    The frontend can listen to this for live alert updates.
    """
    state = get_app_state()

    async def event_generator():
        last_count = len(state["alerts"])
        while True:
            current_count = len(state["alerts"])
            if current_count < last_count:
                last_count = current_count
            elif current_count > last_count:
                # Send new alerts
                new_alerts = state["alerts"][last_count:current_count]
                for alert in new_alerts:
                    data = alert.model_dump_json()
                    yield f"data: {data}\n\n"
                last_count = current_count

            # Also send periodic heartbeat
            yield f": heartbeat\n\n"
            await asyncio.sleep(1)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )


# ──────────────────────────────────────────────
# GET /ips/metrics
# ──────────────────────────────────────────────
@router.get("/metrics", response_model=MetricsResponse)
async def get_metrics():
    """
    Return system-wide IPS metrics including throughput, 
    blocked IPs, detection rates, and device statuses.
    """
    state = get_app_state()
    detector = state["detector"]
    network = state["network"]
    mitigator = state["mitigator"]

    blocked_count = sum(
        1 for a in state["alerts"] 
        if a.actionTaken and a.actionTaken.value == "blocked"
    )
    prevented_count = sum(
        1 for a in state["alerts"] 
        if a.actionTaken and a.actionTaken.value == "prevented"
    )

    ml_metrics = detector.get_ml_metrics()

    return MetricsResponse(
        simulation_running=state["running"],
        total_packets=state["total_packets"],
        total_alerts=len(state["alerts"]),
        total_blocked=blocked_count,
        total_prevented=prevented_count,
        blocked_ips=list(network.blocked_ips),
        quarantined_devices=list(network.quarantined_devices),
        packets_per_second=state.get("pps", 0),
        detection_rate=detector.get_detection_rate(),
        false_positive_rate=detector.get_false_positive_rate(),
        devices=network.get_all_devices(),
        active_attack=state["attack_simulator"].active_attack,
        active_attack_attacker_id=state["attack_simulator"].attacker_device["id"] if state["attack_simulator"].attacker_device else ("EXTERNAL" if state["attack_simulator"].active_attack else None),
        active_attack_target_id=state["attack_simulator"].target_device["id"] if state["attack_simulator"].target_device else ("GW_01" if state["attack_simulator"].active_attack else None),
        ml_model_trained=detector.ml_detector.is_trained,
        ml_precision=ml_metrics["ml_precision"],
        ml_recall=ml_metrics["ml_recall"],
        ml_f1_score=ml_metrics["ml_f1_score"],
        ml_accuracy=ml_metrics["ml_accuracy"],
        confusion_matrix=ml_metrics["confusion_matrix"],
    )


# ──────────────────────────────────────────────
# GET /ips/logs
# ──────────────────────────────────────────────
@router.get("/logs", response_model=list[LogEntry])
async def get_logs(limit: int = Query(50, ge=1, le=500)):
    """Fetch the most recent system event logs."""
    state = get_app_state()
    logs = state["logs"][-limit:]
    logs.reverse()
    return logs


# ──────────────────────────────────────────────
# GET /ips/logs/stream (SSE for logs)
# ──────────────────────────────────────────────
@router.get("/logs/stream")
async def stream_logs():
    """Real-time log stream via Server-Sent Events."""
    state = get_app_state()

    async def event_generator():
        last_count = len(state["logs"])
        while True:
            current_count = len(state["logs"])
            if current_count < last_count:
                last_count = current_count
            elif current_count > last_count:
                new_logs = state["logs"][last_count:current_count]
                for log in new_logs:
                    data = log.model_dump_json()
                    yield f"data: {data}\n\n"
                last_count = current_count
            yield f": heartbeat\n\n"
            await asyncio.sleep(1)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )


# ──────────────────────────────────────────────
# GET /ips/traffic-chart
# ──────────────────────────────────────────────
@router.get("/traffic-chart", response_model=list[ChartDataPoint])
async def get_traffic_chart():
    """
    Return traffic volume data points for the dashboard chart.
    Aggregated from the rolling traffic history.
    """
    state = get_app_state()
    return state.get("traffic_chart", [])


# ──────────────────────────────────────────────
# POST /ips/reset
# ──────────────────────────────────────────────
@router.post("/reset")
async def reset_ips():
    """Reset all IPS state: alerts, logs, blocked IPs, ML model."""
    state = get_app_state()
    state["alerts"].clear()
    state["logs"].clear()
    state["total_packets"] = 0
    state["uptime"] = 0
    state["traffic_chart"] = []
    state["detector"].reset()
    state["mitigator"].reset()
    state["network"].reset()
    state["attack_simulator"].stop_attack()
    state["baseline_trained"] = False
    return {"status": "reset_complete"}


# ──────────────────────────────────────────────
# POST /ips/clear-logs
# ──────────────────────────────────────────────
@router.post("/clear-logs")
async def clear_logs():
    """Clear only logs and alerts. Leaves device registry, blocked IPs, and ML model baseline intact."""
    import uuid
    state = get_app_state()
    state["alerts"].clear()
    state["logs"].clear()
    
    # Reset detector stats but not baseline training
    state["detector"]._packet_counts.clear()
    state["detector"]._auth_attempts.clear()
    state["detector"]._sensor_history.clear()
    state["detector"].total_inspected = 0
    state["detector"].total_flagged = 0
    state["detector"].true_positives = 0
    state["detector"].false_positives = 0
    
    state["mitigator"].dropped_packets = 0
    state["mitigator"].mitigation_log.clear()
    
    # Log the clear event
    state["logs"].append(LogEntry(
        id=f"LOG-{uuid.uuid4().hex[:8]}",
        timestamp=datetime.now().strftime("%H:%M:%S"),
        source="SYSTEM",
        category="SYSTEM",
        message="IPS activity logs and alerts cleared by user.",
        status="SUCCESS",
    ))
    return {"status": "clear_complete"}


# ──────────────────────────────────────────────
# GET /ips/firewall-script
# ──────────────────────────────────────────────
@router.get("/firewall-script")
async def get_firewall_script(ip: str, os_type: str = "windows"):
    """Generate and download a firewall rule script to block the attacker IP."""
    if os_type.lower() == "windows":
        script_content = (
            f"# PowerShell script to block malicious IP: {ip}\n"
            f"# Run as Administrator\n\n"
            f"New-NetFirewallRule -DisplayName \"Intelli IPS Block {ip}\" "
            f"-Direction Inbound -Action Block -RemoteAddress {ip}\n"
            f"Write-Host \"Successfully blocked inbound traffic from {ip}\"\n"
        )
        media_type = "application/octet-stream"
        filename = f"block-{ip.replace('.', '_')}.ps1"
    else:
        script_content = (
            f"#!/bin/bash\n"
            f"# Shell script to block malicious IP: {ip}\n"
            f"# Run with sudo\n\n"
            f"sudo iptables -A INPUT -s {ip} -j DROP\n"
            f"echo \"Successfully blocked inbound traffic from {ip}\"\n"
        )
        media_type = "application/x-sh"
        filename = f"block-{ip.replace('.', '_')}.sh"

    return Response(
        content=script_content,
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


# ──────────────────────────────────────────────
# POST /ips/retrain
# ──────────────────────────────────────────────
class RetrainRequest(BaseModel):
    contamination: float
    n_estimators: int

@router.post("/retrain")
async def retrain_ml_model(req: RetrainRequest):
    """Retrain the Isolation Forest model with custom hyperparameters."""
    state = get_app_state()
    detector = state["detector"]
    
    # Update hyperparameters
    detector.ml_detector.model = detector.ml_detector.model.__class__(
        contamination=req.contamination,
        n_estimators=req.n_estimators,
        random_state=42
    )
    
    # Collect all normal packets from history or generate normal data to retrain
    from simulation.traffic import generate_traffic_batch
    active_devices = state["network"].get_active_devices()
    normal_packets = []
    for _ in range(20):
        normal_packets.extend(generate_traffic_batch(active_devices))
        
    baselines = {
        d["id"]: d.get("normal_packet_rate", 5)
        for d in state["network"].devices.values()
    }
    detector.train_ml_model(normal_packets, baselines)
    
    # Log retraining
    import uuid
    state["logs"].append(LogEntry(
        id=f"LOG-{uuid.uuid4().hex[:8]}",
        timestamp=datetime.now().strftime("%H:%M:%S"),
        source="IPS_ENGINE",
        category="SYSTEM",
        message=f"ML Anomaly Model retrained. Contamination: {req.contamination}, Estimators: {req.n_estimators}.",
        status="SUCCESS",
    ))
    
    return {"status": "success", "message": "ML Model retrained successfully."}


# ──────────────────────────────────────────────
# GET /ips/reports/download
# ──────────────────────────────────────────────
@router.get("/reports/download")
async def download_report_csv():
    """Export the security audit report as a detailed CSV file."""
    import io
    import csv
    
    state = get_app_state()
    detector = state["detector"]
    network = state["network"]
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Title Section
    writer.writerow(["INTELLI IPS - SECURITY INCIDENT AUDIT REPORT"])
    writer.writerow(["Generated At", datetime.now().strftime("%Y-%m-%d %H:%M:%S")])
    writer.writerow([])
    
    # Summary Metrics
    writer.writerow(["SUMMARY METRICS"])
    writer.writerow(["Total Inspected Packets", state["total_packets"]])
    writer.writerow(["Total Flagged Threats", len(state["alerts"])])
    blocked_count = sum(1 for a in state["alerts"] if a.actionTaken and a.actionTaken.value == "blocked")
    writer.writerow(["Prevented Actions (Blocked)", blocked_count])
    writer.writerow(["Detection Rate", f"{detector.get_detection_rate()}%"])
    writer.writerow(["False Positive Rate", f"{detector.get_false_positive_rate()}%"])
    writer.writerow([])
    
    # Device Registry
    writer.writerow(["DEVICE INVENTORY"])
    writer.writerow(["Device ID", "Name", "Type", "IP Address", "MAC Address", "Status", "Allowed Whitelist"])
    for dev in network.get_all_devices():
        writer.writerow([dev["id"], dev["name"], dev["type"], dev.get("ip", ""), dev.get("mac", ""), dev["status"], dev.get("allowed", True)])
    writer.writerow([])
    
    # Active Threats
    writer.writerow(["SECURITY ALERTS LOG"])
    writer.writerow(["Alert ID", "Timestamp", "Source IP", "Device Name", "Device ID", "Threat Level", "Threat Name", "Assessment", "Confidence (%)", "Action Taken", "Detection Method"])
    for alert in state["alerts"]:
        writer.writerow([
            alert.id,
            alert.timestamp,
            alert.source_ip or "",
            alert.device,
            alert.deviceId,
            alert.risk.value,
            alert.threat,
            alert.assessment,
            alert.confidence,
            alert.actionTaken.value if alert.actionTaken else "",
            alert.detectionMethod.value if alert.detectionMethod else ""
        ])
        
    output.seek(0)
    
    filename = f"intelli_ips_audit_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode("utf-8")),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

