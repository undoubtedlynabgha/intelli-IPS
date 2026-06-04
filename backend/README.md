# Intelli IPS — Backend

AI-Driven Intrusion Prevention System for IoT Networks.

## System Scope & Design Choices

**Core Features Supported:**
- Simulated IoT mesh (MQTT / CoAP / HTTP traffic as structured events)
- Attack injector: DoS, brute-force, data spoofing
- Hybrid IPS: signature thresholds + Isolation Forest + Z-score spoofing
- Mitigation: drop, block IP, quarantine device, JSON alerts/logs
- FastAPI REST + optional SSE streams

**Simplified / Excluded Modules:**
- **Real PCAP / Wireshark** — JSON packet events are used for high-performance simulation and reporting
- **Live MQTT/CoAP brokers** — simulated internally to run out-of-the-box without extra infrastructure dependencies
- **Multiple ML models (LOF + KNN + ensemble)** — optimized using Isolation Forest combined with statistical spoofing detection
- **Distributed Simulation** — implemented as an efficient single-process `asyncio` loop
- **SIEM/SOC integrations** — simulated via UI toggle protocols

## Quick Start

```bash
# 1. Create virtual environment
python -m venv venv
venv\Scripts\activate  # Windows

# 2. Install dependencies
pip install -r requirements.txt

# 3. Run the server
python main.py
```

The API will be available at **http://localhost:8000**  
Interactive docs at **http://localhost:8000/docs**

## API Endpoints

### Simulation Control
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/simulation/start` | Start the IoT network simulation |
| `POST` | `/simulation/stop` | Stop the simulation |
| `POST` | `/simulation/attack` | Inject an attack (`dos_mqtt`, `dos_coap`, `brute_force`, `data_spoofing`) |
| `POST` | `/simulation/attack/stop` | Manually stop active attack |
| `GET`  | `/simulation/status` | Get simulation status |

### IPS Engine
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`  | `/ips/alerts` | Fetch recent alerts |
| `GET`  | `/ips/alerts/stream` | Real-time alert stream (SSE) |
| `GET`  | `/ips/metrics` | System metrics & device statuses |
| `GET`  | `/ips/logs` | Fetch event logs |
| `GET`  | `/ips/logs/stream` | Real-time log stream (SSE) |
| `GET`  | `/ips/traffic-chart` | Traffic volume chart data |
| `POST` | `/ips/reset` | Reset all IPS state |

### Device Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`  | `/devices/` | List all devices |
| `GET`  | `/devices/{id}` | Get device details |
| `POST` | `/devices/` | Commission new device |
| `POST` | `/devices/{id}/block` | Block a device |
| `POST` | `/devices/{id}/unblock` | Unblock a device |

## Architecture

```
main.py (FastAPI + Simulation Loop)
  ├── simulation/
  │     ├── network.py    → IoT device registry & state
  │     ├── traffic.py    → Normal traffic generation
  │     └── attacks.py    → Attack pattern injection
  ├── engine/
  │     ├── detector.py   → Hybrid detection (Signature + ML)
  │     ├── ml_model.py   → Isolation Forest anomaly detector
  │     └── mitigator.py  → Prevention actions (block/quarantine)
  └── api/
        ├── simulation_routes.py
        ├── ips_routes.py
        └── device_routes.py
```

## Attack Types

| Type | Key | Description |
|------|-----|-------------|
| DoS (MQTT) | `dos_mqtt` | MQTT broker flooding with high-rate PUBLISH packets |
| DoS (CoAP) | `dos_coap` | CoAP amplification-style flood |
| Brute Force | `brute_force` | Rapid AUTH attempts against device endpoints |
| Data Spoofing | `data_spoofing` | Sensor value injection with unrealistic readings |
