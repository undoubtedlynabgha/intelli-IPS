"""
Intelli IPS — Traffic Generator
Generates realistic baseline (normal) IoT traffic packets for all active devices.
"""

import random
import uuid
import logging
from datetime import datetime
from models.schemas import TrafficPacket

logger = logging.getLogger("intelli_ips.traffic")

# Realistic protocol-specific packet types
PROTOCOL_PACKET_TYPES = {
    "MQTT": ["PUBLISH", "SUBSCRIBE", "CONNECT", "PINGREQ", "DISCONNECT"],
    "CoAP": ["GET", "PUT", "POST", "OBSERVE"],
    "HTTP": ["GET", "POST", "PUT", "HEAD"],
}

# Realistic sensor value ranges by device type
SENSOR_BASELINES = {
    "thermostat": {"min": 18.0, "max": 28.0, "unit": "°C"},
    "sensors": {"min": 20.0, "max": 95.0, "unit": "ppm"},
    "videocam": {"min": 0.0, "max": 100.0, "unit": "fps"},
    "lightbulb": {"min": 0, "max": 100, "unit": "%"},
    "lock": {"min": 0, "max": 1, "unit": "state"},
    "router": {"min": 0, "max": 1000, "unit": "Mbps"},
    "precision_manufacturing": {"min": 0.0, "max": 500.0, "unit": "RPM"},
    "speaker": {"min": 0, "max": 100, "unit": "vol"},
    "power": {"min": 0.0, "max": 3000.0, "unit": "W"},
    "tv": {"min": 0, "max": 1, "unit": "state"},
    "kitchen": {"min": -20.0, "max": 8.0, "unit": "°C"},
}


def generate_normal_traffic(device: dict) -> list[TrafficPacket]:
    """
    Generate a batch of normal traffic packets from a single device.
    Each device produces packets according to its baseline rate and protocol.
    """
    packets = []
    rate = device.get("normal_packet_rate", 3)
    # Add slight randomness to make it realistic (±30%)
    count = max(1, int(rate * random.uniform(0.7, 1.3)))
    protocol = device.get("protocol") or "HTTP"
    payload_min, payload_max = device.get("normal_payload_range", (20, 100))

    for _ in range(count):
        # Generate realistic sensor value if applicable
        sensor_value = None
        baseline = SENSOR_BASELINES.get(device["type"])
        if baseline:
            center = (baseline["min"] + baseline["max"]) / 2
            spread = (baseline["max"] - baseline["min"]) / 4
            sensor_value = round(random.gauss(center, spread), 2)
            # Clamp to reasonable bounds (normal traffic stays in range)
            sensor_value = max(baseline["min"] * 0.8, min(baseline["max"] * 1.2, sensor_value))

        packet = TrafficPacket(
            id=f"PKT-{uuid.uuid4().hex[:8]}",
            timestamp=datetime.now(),
            source_ip=device.get("ip", "0.0.0.0"),
            source_device_id=device["id"],
            destination_ip="192.168.1.1",
            protocol=protocol,
            payload_size=random.randint(payload_min, payload_max),
            packet_type=random.choice(PROTOCOL_PACKET_TYPES.get(protocol, ["DATA"])),
            sensor_value=sensor_value,
            is_malicious=False,
            attack_type=None,
        )
        packets.append(packet)

    return packets


def generate_traffic_batch(active_devices: list[dict]) -> list[TrafficPacket]:
    """Generate one tick's worth of normal traffic from all active devices."""
    all_packets = []
    for device in active_devices:
        all_packets.extend(generate_normal_traffic(device))
    return all_packets
