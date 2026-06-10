"""
Intelli IPS — Central Configuration
All tunable constants for the simulation, detection engine, and API.
"""

# ──────────────────────────────────────────────
# Simulation Settings
# ──────────────────────────────────────────────
SIMULATION_TICK_INTERVAL = 1.0  # seconds between traffic generation cycles
NORMAL_TRAFFIC_RATE = 5         # packets per tick per device (baseline)
MAX_TRAFFIC_HISTORY = 500       # max packets kept in memory for analysis

# ──────────────────────────────────────────────
# IoT Device Defaults
# ──────────────────────────────────────────────
DEFAULT_DEVICES = [
    {
        "id": "GW_01", "name": "Smart_Home_Hub", "type": "router",
        "ip": "192.168.1.1", "mac": "AA:BB:CC:00:01:01",
        "protocol": "HTTP", "status": "online",
        "normal_packet_rate": 10, "normal_payload_range": (50, 200),
    },
    {
        "id": "CAM_04", "name": "Front_Door_Camera", "type": "videocam",
        "ip": "192.168.1.105", "mac": "AA:BB:CC:00:04:05",
        "protocol": "HTTP", "status": "online",
        "normal_packet_rate": 8, "normal_payload_range": (200, 800),
    },
    {
        "id": "HVAC_01", "name": "Living_Room_Thermostat", "type": "thermostat",
        "ip": "192.168.1.55", "mac": "AA:BB:CC:00:55:01",
        "protocol": "MQTT", "status": "online",
        "normal_packet_rate": 3, "normal_payload_range": (20, 60),
    },
    {
        "id": "DOOR_01", "name": "Front_Door_Lock", "type": "lock",
        "ip": "192.168.1.80", "mac": "AA:BB:CC:00:80:01",
        "protocol": "CoAP", "status": "online",
        "normal_packet_rate": 2, "normal_payload_range": (10, 30),
    },
    {
        "id": "SENS_A", "name": "Kitchen_Smoke_Detector", "type": "sensors",
        "ip": "192.168.1.200", "mac": "AA:BB:CC:02:00:0A",
        "protocol": "MQTT", "status": "online",
        "normal_packet_rate": 6, "normal_payload_range": (15, 50),
    },
    {
        "id": "LGHT_01", "name": "Bedroom_Smart_Light", "type": "lightbulb",
        "ip": "192.168.1.50", "mac": "AA:BB:CC:00:50:01",
        "protocol": "CoAP", "status": "online",
        "normal_packet_rate": 2, "normal_payload_range": (5, 20),
    },
    {
        "id": "SPK_01", "name": "Living_Room_Speaker", "type": "speaker",
        "ip": "192.168.1.120", "mac": "AA:BB:CC:00:20:01",
        "protocol": "CoAP", "status": "online",
        "normal_packet_rate": 3, "normal_payload_range": (15, 45),
    },
    {
        "id": "PLG_01", "name": "Coffee_Maker_Plug", "type": "power",
        "ip": "192.168.1.75", "mac": "AA:BB:CC:00:75:01",
        "protocol": "MQTT", "status": "online",
        "normal_packet_rate": 4, "normal_payload_range": (10, 35),
    },
]

# ──────────────────────────────────────────────
# Signature Detection Rules
# ──────────────────────────────────────────────
# Thresholds for signature-based detection
DOS_PACKET_THRESHOLD = 50          # packets/sec from a single source → DoS
BRUTE_FORCE_ATTEMPT_THRESHOLD = 5  # failed auths within window → brute-force
BRUTE_FORCE_WINDOW_SECONDS = 10
SPOOFING_VALUE_DEVIATION = 5.0     # Z-score threshold for data spoofing

# ──────────────────────────────────────────────
# Anomaly Detection (ML) Settings
# ──────────────────────────────────────────────
ANOMALY_CONTAMINATION = 0.05       # expected anomaly fraction for Isolation Forest
ANOMALY_RETRAIN_INTERVAL = 500     # retrain after N new normal packets
ML_FEATURE_WINDOW = 50            # sliding window size for feature extraction

# ──────────────────────────────────────────────
# Attack Simulator Defaults
# ──────────────────────────────────────────────
ATTACK_CONFIGS = {
    "dos_mqtt": {
        "label": "MQTT Broker Flooding (DoS)",
        "protocol": "MQTT",
        "packet_rate": 200,        # packets per tick (massive flood)
        "payload_size": 10,
        "duration_ticks": 30,
    },
    "dos_coap": {
        "label": "CoAP Amplification Flood",
        "protocol": "CoAP",
        "packet_rate": 150,
        "payload_size": 5,
        "duration_ticks": 25,
    },
    "brute_force": {
        "label": "Brute-Force SSH/Auth Attempt",
        "protocol": "HTTP",
        "attempts_per_tick": 10,
        "duration_ticks": 20,
    },
    "data_spoofing": {
        "label": "Sensor Data Spoofing (Anomaly)",
        "protocol": "MQTT",
        "spoofed_value_range": (500, 9999),  # wildly unrealistic sensor values
        "normal_value_range": (18, 30),       # realistic temperature range
        "duration_ticks": 25,
    },
    "heavy_traffic": {
        "label": "High-Load Traffic Simulation",
        "protocol": "HTTP",
        "packet_rate": 30,         # high rate, but below DoS threshold of 50
        "payload_size": 150,
        "duration_ticks": 30,
    },
}

# ──────────────────────────────────────────────
# API Settings
# ──────────────────────────────────────────────
API_HOST = "0.0.0.0"
API_PORT = 8000
CORS_ORIGINS = ["*"]  # Allow all for dev — restrict in production

# ──────────────────────────────────────────────
# User authentication handling (hashed passwords)
# ──────────────────────────────────────────────
import json, hashlib, os, sys
from typing import List, Dict, Optional

def _resolve_userdata_dir() -> str:
    """
    Return a writable directory for persistent data (users.json, etc.).
    Priority:
      1. IPS_USERDATA env var (set by Electron main.js when launching the exe)
      2. When frozen by PyInstaller: %APPDATA%\\Intelli IPS\\
      3. Development: directory next to this config.py file
    """
    env_path = os.environ.get("IPS_USERDATA", "").strip()
    if env_path and os.path.isdir(env_path):
        return env_path

    if getattr(sys, "frozen", False):
        # Packaged — use Windows APPDATA or fall back to exe directory
        appdata = os.environ.get("APPDATA", "")
        if appdata:
            target = os.path.join(appdata, "Intelli IPS")
        else:
            target = os.path.dirname(sys.executable)
        os.makedirs(target, exist_ok=True)
        return target

    # Development mode
    return os.path.dirname(__file__)

USER_DB_PATH = os.path.join(_resolve_userdata_dir(), "users.json")

class UserStore:
    """Simple file‑based user store with SHA‑256 password hashing."""
    def __init__(self, path: str = USER_DB_PATH):
        self.path = path
        if not os.path.exists(self.path):
            # Initialise with a default admin user (password: admin)
            default_admin = {
                "username": "admin",
                "password_hash": hashlib.sha256("admin".encode()).hexdigest(),
                "role": "admin",
            }
            with open(self.path, "w", encoding="utf-8") as f:
                json.dump([default_admin], f, indent=2)

    def _load_users(self) -> List[Dict]:
        with open(self.path, "r", encoding="utf-8") as f:
            return json.load(f)

    def _save_users(self, users: List[Dict]):
        with open(self.path, "w", encoding="utf-8") as f:
            json.dump(users, f, indent=2)

    def get_user(self, username: str) -> Optional[Dict]:
        for u in self._load_users():
            if u.get("username") == username:
                return u
        return None

    def verify_credentials(self, username: str, password: str) -> bool:
        user = self.get_user(username)
        if not user:
            return False
        return user.get("password_hash") == hashlib.sha256(password.encode()).hexdigest()

    def add_user(self, username: str, password: str, role: str = "user") -> bool:
        if self.get_user(username):
            return False
        users = self._load_users()
        users.append({
            "username": username,
            "password_hash": hashlib.sha256(password.encode()).hexdigest(),
            "role": role,
        })
        self._save_users(users)
        return True

def get_user_store() -> UserStore:
    return UserStore()
