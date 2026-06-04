"""
Intelli IPS — Pydantic Schemas
Data models matching the frontend TypeScript types for seamless integration.
"""

from pydantic import BaseModel, Field
from typing import Optional, Literal
from enum import Enum
from datetime import datetime


# ──────────────────────────────────────────────
# Enums
# ──────────────────────────────────────────────
class RiskLevel(str, Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    WARNING = "WARNING"
    INFO = "INFO"
    ANOMALY = "ANOMALY"


class DeviceStatus(str, Enum):
    ONLINE = "online"
    OFFLINE = "offline"
    THREAT = "threat"
    BLOCKED = "blocked"


class ActionTaken(str, Enum):
    DETECTED = "detected"
    PREVENTED = "prevented"
    BLOCKED = "blocked"


class AttackType(str, Enum):
    DOS_MQTT = "dos_mqtt"
    DOS_COAP = "dos_coap"
    BRUTE_FORCE = "brute_force"
    DATA_SPOOFING = "data_spoofing"
    HEAVY_TRAFFIC = "heavy_traffic"


class DetectionMethod(str, Enum):
    SIGNATURE = "signature"
    ANOMALY_ML = "anomaly_ml"
    STATISTICAL = "statistical"


# ──────────────────────────────────────────────
# Device Model
# ──────────────────────────────────────────────
class Device(BaseModel):
    id: str
    name: str
    type: Literal["router", "videocam", "thermostat", "lock", "sensors", "lightbulb", "precision_manufacturing"]
    ip: Optional[str] = None
    mac: Optional[str] = None
    status: DeviceStatus = DeviceStatus.ONLINE
    details: Optional[str] = None
    protocol: Optional[str] = None
    allowed: bool = True


# ──────────────────────────────────────────────
# Traffic Packet (Internal representation)
# ──────────────────────────────────────────────
class TrafficPacket(BaseModel):
    id: str
    timestamp: datetime = Field(default_factory=datetime.now)
    source_ip: str
    source_device_id: str
    destination_ip: str = "192.168.1.1"  # default: gateway
    protocol: str                         # MQTT, CoAP, HTTP
    payload_size: int                     # bytes
    packet_type: str = "DATA"             # DATA, AUTH, PUBLISH, GET, PUT
    sensor_value: Optional[float] = None  # for sensor devices
    is_malicious: bool = False            # ground truth for evaluation
    attack_type: Optional[str] = None     # if malicious, which attack


# ──────────────────────────────────────────────
# Alert Model (matches frontend Alert interface)
# ──────────────────────────────────────────────
class Alert(BaseModel):
    id: str
    risk: RiskLevel
    timestamp: str
    device: str       # device name
    deviceId: str     # device ID
    threat: str       # threat title
    assessment: str   # short assessment label
    confidence: int   # 0-100
    description: str
    tags: list[str] = []
    actionTaken: Optional[ActionTaken] = None
    detectionMethod: Optional[DetectionMethod] = None
    source_ip: Optional[str] = None


# ──────────────────────────────────────────────
# Log Entry (matches frontend LogEntry interface)
# ──────────────────────────────────────────────
class LogEntry(BaseModel):
    id: str
    timestamp: str
    source: str
    category: Literal["SYSTEM", "NETWORK", "AUTH", "IO", "MITIGATION"]
    message: str
    status: Literal["INFO", "SUCCESS", "WARNING", "ERROR", "BLOCKED"]


# ──────────────────────────────────────────────
# API Request / Response Models
# ──────────────────────────────────────────────
class AttackRequest(BaseModel):
    attack_type: AttackType
    target_device_id: Optional[str] = None  # if None, picks random target
    attacker_device_id: Optional[str] = None
    packet_rate: Optional[int] = None


class SimulationStatus(BaseModel):
    running: bool
    uptime_seconds: float = 0
    total_packets_generated: int = 0
    total_attacks_injected: int = 0
    active_attack: Optional[str] = None


class MetricsResponse(BaseModel):
    simulation_running: bool
    total_packets: int
    total_alerts: int
    total_blocked: int
    total_prevented: int
    blocked_ips: list[str]
    quarantined_devices: list[str]
    packets_per_second: float
    detection_rate: float         # percentage of malicious packets caught
    false_positive_rate: float    # percentage of normal packets flagged
    devices: list[Device]
    active_attack: Optional[str] = None
    ml_model_trained: bool = False


class ChartDataPoint(BaseModel):
    time: str
    value: int
