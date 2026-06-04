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
        "id": "GW_01", "name": "IoT_Gateway_Main", "type": "router",
        "ip": "192.168.1.1", "mac": "AA:BB:CC:00:01:01",
        "protocol": "HTTP", "status": "online",
        "normal_packet_rate": 10, "normal_payload_range": (50, 200),
    },
    {
        "id": "CAM_04", "name": "CAM_EXT_04", "type": "videocam",
        "ip": "192.168.1.105", "mac": "AA:BB:CC:00:04:05",
        "protocol": "HTTP", "status": "online",
        "normal_packet_rate": 8, "normal_payload_range": (200, 800),
    },
    {
        "id": "HVAC_01", "name": "HVAC_Main", "type": "thermostat",
        "ip": "10.0.0.55", "mac": "AA:BB:CC:00:55:01",
        "protocol": "MQTT", "status": "online",
        "normal_packet_rate": 3, "normal_payload_range": (20, 60),
    },
    {
        "id": "DOOR_01", "name": "Door_Rear", "type": "lock",
        "ip": "192.168.1.80", "mac": "AA:BB:CC:00:80:01",
        "protocol": "CoAP", "status": "online",
        "normal_packet_rate": 2, "normal_payload_range": (10, 30),
    },
    {
        "id": "SENS_A", "name": "Sensor_Cluster_A", "type": "sensors",
        "ip": "192.168.1.200", "mac": "AA:BB:CC:02:00:0A",
        "protocol": "MQTT", "status": "online",
        "normal_packet_rate": 6, "normal_payload_range": (15, 50),
    },
    {
        "id": "LGHT_01", "name": "Light_Grid_01", "type": "lightbulb",
        "ip": "192.168.1.50", "mac": "AA:BB:CC:00:50:01",
        "protocol": "CoAP", "status": "online",
        "normal_packet_rate": 2, "normal_payload_range": (5, 20),
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
ANOMALY_RETRAIN_INTERVAL = 100     # retrain after N new normal packets
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
