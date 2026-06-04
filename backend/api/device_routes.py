"""
Intelli IPS — Device API Routes
Endpoints for managing IoT devices in the simulated network.
"""

from fastapi import APIRouter, HTTPException
from models.schemas import Device

router = APIRouter(prefix="/devices", tags=["Devices"])


def get_app_state():
    from main import app_state
    return app_state


# ──────────────────────────────────────────────
# GET /devices
# ──────────────────────────────────────────────
@router.get("/", response_model=list[Device])
async def list_devices():
    """List all IoT devices in the network."""
    state = get_app_state()
    return state["network"].get_all_devices()


# ──────────────────────────────────────────────
# GET /devices/{device_id}
# ──────────────────────────────────────────────
@router.get("/{device_id}", response_model=Device)
async def get_device(device_id: str):
    """Get details of a specific device."""
    state = get_app_state()
    dev = state["network"].get_device(device_id)
    if not dev:
        raise HTTPException(status_code=404, detail="Device not found")
    return Device(
        id=dev["id"], name=dev["name"], type=dev["type"],
        ip=dev.get("ip"), mac=dev.get("mac"),
        status=dev["status"], details=dev.get("details"),
        protocol=dev.get("protocol"), allowed=dev.get("allowed", True)
    )


# ──────────────────────────────────────────────
# POST /devices
# ──────────────────────────────────────────────
@router.post("/", response_model=Device)
async def add_device(device: Device):
    """Commission a new IoT device into the network."""
    state = get_app_state()
    if state["network"].get_device(device.id):
        raise HTTPException(status_code=409, detail=f"Device {device.id} already exists")
    return state["network"].add_device(device.model_dump())


# ──────────────────────────────────────────────
# POST /devices/{device_id}/allow
# ──────────────────────────────────────────────
@router.post("/{device_id}/allow")
async def allow_device(device_id: str, allowed: bool):
    """Set whether a device is in the allowed whitelist."""
    state = get_app_state()
    dev = state["network"].get_device(device_id)
    if not dev:
        raise HTTPException(status_code=404, detail="Device not found")
    
    dev["allowed"] = allowed
    
    import uuid
    from datetime import datetime
    from models.schemas import LogEntry
    
    # If the user disallowed the device and it is online or threat, quarantine/block it immediately
    if not allowed and dev["status"] != "blocked":
        state["network"].quarantine_device(device_id)
        if dev.get("ip"):
            state["network"].block_ip(dev["ip"])
        # Log this blocking event
        state["logs"].append(LogEntry(
            id=f"LOG-{uuid.uuid4().hex[:8]}",
            timestamp=datetime.now().strftime("%H:%M:%S"),
            source=device_id,
            category="MITIGATION",
            message=f"Device {dev['name']} ({device_id}) blocked: removed from Whitelist.",
            status="BLOCKED"
        ))
    elif allowed and dev["status"] == "blocked" and "QUARANTINED" in (dev.get("details") or ""):
        # If the user allowed a quarantined device, unblock it
        state["network"].unquarantine_device(device_id)
        if dev.get("ip"):
            state["network"].unblock_ip(dev["ip"])
        # Log this unblocking event
        state["logs"].append(LogEntry(
            id=f"LOG-{uuid.uuid4().hex[:8]}",
            timestamp=datetime.now().strftime("%H:%M:%S"),
            source=device_id,
            category="MITIGATION",
            message=f"Device {dev['name']} ({device_id}) allowed: added back to Whitelist.",
            status="SUCCESS"
        ))
            
    return {"status": "success", "device_id": device_id, "allowed": allowed}


# ──────────────────────────────────────────────
# POST /devices/{device_id}/block
# ──────────────────────────────────────────────
@router.post("/{device_id}/block")
async def block_device(device_id: str):
    """Manually block a device by quarantining it."""
    state = get_app_state()
    dev = state["network"].get_device(device_id)
    if not dev:
        raise HTTPException(status_code=404, detail="Device not found")

    state["network"].quarantine_device(device_id)
    if dev.get("ip"):
        state["network"].block_ip(dev["ip"])
    return {"status": "blocked", "device_id": device_id}


# ──────────────────────────────────────────────
# POST /devices/{device_id}/unblock
# ──────────────────────────────────────────────
@router.post("/{device_id}/unblock")
async def unblock_device(device_id: str):
    """Unblock / release a device from quarantine."""
    state = get_app_state()
    dev = state["network"].get_device(device_id)
    if not dev:
        raise HTTPException(status_code=404, detail="Device not found")

    state["network"].unquarantine_device(device_id)
    if dev.get("ip"):
        state["network"].unblock_ip(dev["ip"])
    return {"status": "unblocked", "device_id": device_id}
