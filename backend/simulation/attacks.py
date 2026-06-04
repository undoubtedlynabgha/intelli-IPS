"""
Intelli IPS — Attack Simulator
Injects malicious traffic patterns into the simulated network on demand.
Supports: DoS/DDoS, Brute-Force, and Data Spoofing attacks.
"""

import random
import uuid
import logging
from datetime import datetime
from typing import Optional
from models.schemas import TrafficPacket, AttackType
from config import ATTACK_CONFIGS

logger = logging.getLogger("intelli_ips.attacks")

# Pool of attacker IPs (external, non-network IPs)
ATTACKER_IPS = [
    "10.99.0.1", "10.99.0.2", "10.99.0.3",
    "172.16.66.1", "172.16.66.2",
    "203.0.113.50", "203.0.113.51",
]


class AttackSimulator:
    """
    Generates malicious traffic packets based on the selected attack type.
    Tracks attack state (active/inactive, remaining duration).
    """

    def __init__(self):
        self.active_attack: Optional[str] = None
        self.attack_config: Optional[dict] = None
        self.remaining_ticks: int = 0
        self.target_device: Optional[dict] = None
        self.attacker_device: Optional[dict] = None
        self.custom_packet_rate: Optional[int] = None
        self.attacker_ip: str = random.choice(ATTACKER_IPS)
        self.total_attacks_injected: int = 0

    def start_attack(self, attack_type: AttackType, target_device: Optional[dict] = None, attacker_device: Optional[dict] = None, custom_packet_rate: Optional[int] = None):
        """Initialize an attack of the given type."""
        config = ATTACK_CONFIGS.get(attack_type.value)
        if not config:
            logger.error(f"Unknown attack type: {attack_type}")
            return

        self.active_attack = attack_type.value
        self.attack_config = config
        self.remaining_ticks = config.get("duration_ticks", 20)
        self.target_device = target_device
        self.attacker_device = attacker_device
        self.custom_packet_rate = custom_packet_rate
        
        if attacker_device:
            self.attacker_ip = attacker_device.get("ip") or random.choice(ATTACKER_IPS)
        else:
            self.attacker_ip = random.choice(ATTACKER_IPS)
            
        self.total_attacks_injected += 1
        logger.warning(
            f"ATTACK STARTED: {config['label']} | "
            f"Target: {target_device['name'] if target_device else 'broadcast'} | "
            f"Attacker: {attacker_device['name'] if attacker_device else self.attacker_ip} | "
            f"Duration: {self.remaining_ticks} ticks"
        )

    def stop_attack(self):
        """Forcefully stop the active attack."""
        if self.active_attack:
            logger.info(f"Attack manually stopped: {self.active_attack}")
        self.active_attack = None
        self.attack_config = None
        self.remaining_ticks = 0
        self.target_device = None
        self.attacker_device = None
        self.custom_packet_rate = None

    def is_active(self) -> bool:
        return self.active_attack is not None and self.remaining_ticks > 0

    def generate_attack_traffic(self) -> list[TrafficPacket]:
        """
        Generate one tick's worth of malicious packets based on the active attack type.
        Returns empty list if no attack is active.
        """
        if not self.is_active() or not self.attack_config:
            if self.active_attack and self.remaining_ticks <= 0:
                logger.info(f"Attack completed: {self.active_attack}")
                self.active_attack = None
            return []

        self.remaining_ticks -= 1
        attack_type = self.active_attack
        config = self.attack_config
        target_ip = self.target_device.get("ip", "192.168.1.1") if self.target_device else "192.168.1.1"
        target_id = self.target_device.get("id", "GW_01") if self.target_device else "GW_01"

        packets = []

        # ─── DoS / DDoS Flood ───────────────────────────
        if attack_type in ("dos_mqtt", "dos_coap"):
            rate = self.custom_packet_rate or config.get("packet_rate", 100)
            rate = max(1, min(400, rate))
            count = int(rate * random.uniform(0.8, 1.2))
            source_ip = self.attacker_ip
            source_device_id = self.attacker_device["id"] if self.attacker_device else "EXTERNAL"
            for _ in range(count):
                packets.append(TrafficPacket(
                    id=f"ATK-{uuid.uuid4().hex[:8]}",
                    timestamp=datetime.now(),
                    source_ip=source_ip,
                    source_device_id=source_device_id,
                    destination_ip=target_ip,
                    protocol=config["protocol"],
                    payload_size=config.get("payload_size", 10),
                    packet_type="PUBLISH" if config["protocol"] == "MQTT" else "GET",
                    sensor_value=None,
                    is_malicious=True,
                    attack_type=attack_type,
                ))

        # ─── Brute-Force Authentication ──────────────────
        elif attack_type == "brute_force":
            attempts = self.custom_packet_rate or config.get("attempts_per_tick", 10)
            attempts = max(1, min(50, attempts))
            count = int(attempts * random.uniform(0.8, 1.2))
            source_ip = self.attacker_ip
            source_device_id = self.attacker_device["id"] if self.attacker_device else "EXTERNAL"
            for _ in range(count):
                packets.append(TrafficPacket(
                    id=f"ATK-{uuid.uuid4().hex[:8]}",
                    timestamp=datetime.now(),
                    source_ip=source_ip,
                    source_device_id=source_device_id,
                    destination_ip=target_ip,
                    protocol="HTTP",
                    payload_size=random.randint(100, 300),
                    packet_type="AUTH",
                    sensor_value=None,
                    is_malicious=True,
                    attack_type="brute_force",
                ))

        # ─── Data Spoofing (Anomaly Injection) ───────────
        elif attack_type == "data_spoofing":
            # Spoofing comes FROM a compromised internal device
            spoofed_dev = self.attacker_device or self.target_device
            spoofed_ip = spoofed_dev.get("ip", "192.168.1.200") if spoofed_dev else "192.168.1.200"
            spoofed_id = spoofed_dev.get("id", "SENS_A") if spoofed_dev else "SENS_A"
            rate = self.custom_packet_rate or random.randint(3, 8)
            rate = max(1, min(20, rate))
            spoof_min, spoof_max = config.get("spoofed_value_range", (500, 9999))
            for _ in range(rate):
                packets.append(TrafficPacket(
                    id=f"ATK-{uuid.uuid4().hex[:8]}",
                    timestamp=datetime.now(),
                    source_ip=spoofed_ip,
                    source_device_id=spoofed_id,
                    destination_ip="192.168.1.1",
                    protocol=config["protocol"],
                    payload_size=random.randint(20, 60),
                    packet_type="PUBLISH",
                    sensor_value=round(random.uniform(spoof_min, spoof_max), 2),
                    is_malicious=True,
                    attack_type="data_spoofing",
                ))

        # ─── High-Load Traffic Simulation ───────────────
        elif attack_type == "heavy_traffic":
            rate = self.custom_packet_rate or config.get("packet_rate", 30)
            rate = max(1, min(400, rate))
            count = int(rate * random.uniform(0.8, 1.2))
            heavy_dev = self.attacker_device or self.target_device
            spoofed_ip = heavy_dev.get("ip", "192.168.1.105") if heavy_dev else "192.168.1.105"
            spoofed_id = heavy_dev.get("id", "CAM_04") if heavy_dev else "CAM_04"
            for _ in range(count):
                packets.append(TrafficPacket(
                    id=f"ATK-{uuid.uuid4().hex[:8]}",
                    timestamp=datetime.now(),
                    source_ip=spoofed_ip,
                    source_device_id=spoofed_id,
                    destination_ip="192.168.1.1",
                    protocol=config["protocol"],
                    payload_size=config.get("payload_size", 150),
                    packet_type="GET",
                    sensor_value=None,
                    is_malicious=True,
                    attack_type="heavy_traffic",
                ))

        return packets
