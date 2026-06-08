"""
Intelli IPS — IoT Network Simulation
Manages the virtual IoT network: devices, state, and the simulation loop.
"""

import asyncio
import time
import logging
from typing import Optional
from models.schemas import Device, DeviceStatus
from config import DEFAULT_DEVICES

logger = logging.getLogger("intelli_ips.network")


class IoTNetwork:
    """
    Represents the simulated IoT network.
    Manages device registry, device states, and blocked/quarantined lists.
    """

    def __init__(self):
        self.devices: dict[str, dict] = {}
        self.blocked_ips: set[str] = set()
        self.quarantined_devices: set[str] = set()
        self._initialize_devices()

    def _initialize_devices(self):
        """Load default devices from config."""
        for dev_cfg in DEFAULT_DEVICES:
            self.devices[dev_cfg["id"]] = {
                **dev_cfg,
                "status": "online",
                "allowed": dev_cfg.get("allowed", True),
            }
        logger.info(f"Network initialized with {len(self.devices)} devices")

    def get_device(self, device_id: str) -> Optional[dict]:
        return self.devices.get(device_id)

    def get_all_devices(self) -> list[Device]:
        """Return all devices as Pydantic models for API serialization."""
        result = []
        for dev in self.devices.values():
            status = dev["status"]
            if dev["id"] in self.quarantined_devices:
                status = "blocked"
            result.append(Device(
                id=dev["id"],
                name=dev["name"],
                type=dev["type"],
                ip=dev.get("ip"),
                mac=dev.get("mac"),
                status=status,
                details=dev.get("details"),
                protocol=dev.get("protocol"),
                allowed=dev.get("allowed", True),
            ))
        return result

    def get_active_devices(self) -> list[dict]:
        """Return devices that are online and not quarantined/blocked."""
        return [
            d for d in self.devices.values()
            if d["status"] == "online"
            and d["id"] not in self.quarantined_devices
            and d.get("ip") not in self.blocked_ips
        ]

    def block_ip(self, ip: str) -> bool:
        """Add an IP to the block list."""
        if ip not in self.blocked_ips:
            self.blocked_ips.add(ip)
            # Update device status if it matches
            for dev in self.devices.values():
                if dev.get("ip") == ip:
                    dev["status"] = "blocked"
                    dev["details"] = f"AUTO-BLOCKED by IPS — IP {ip}"
            logger.warning(f"IP BLOCKED: {ip}")
            return True
        return False

    def quarantine_device(self, device_id: str) -> bool:
        """Quarantine a device (isolate from network)."""
        if device_id in self.devices and device_id not in self.quarantined_devices:
            self.quarantined_devices.add(device_id)
            self.devices[device_id]["status"] = "blocked"
            self.devices[device_id]["details"] = "QUARANTINED by IPS Engine"
            logger.warning(f"DEVICE QUARANTINED: {device_id}")
            return True
        return False

    def unblock_ip(self, ip: str) -> bool:
        """Remove an IP from the block list."""
        if ip in self.blocked_ips:
            self.blocked_ips.discard(ip)
            for dev in self.devices.values():
                if dev.get("ip") == ip and dev["id"] not in self.quarantined_devices:
                    dev["status"] = "online"
                    dev["details"] = None
            return True
        return False

    def unquarantine_device(self, device_id: str) -> bool:
        """Release a device from quarantine."""
        if device_id in self.quarantined_devices:
            self.quarantined_devices.discard(device_id)
            dev = self.devices.get(device_id)
            if dev and dev.get("ip") not in self.blocked_ips:
                dev["status"] = "online"
                dev["details"] = None
            return True
        return False

    def set_device_threat(self, device_id: str):
        """Mark a device as having an active threat."""
        if device_id in self.devices:
            if self.devices[device_id]["status"] == "online":
                self.devices[device_id]["status"] = "threat"

    def clear_device_threat(self, device_id: str):
        """Clear threat status from a device (if not blocked/quarantined)."""
        if device_id in self.devices:
            dev = self.devices[device_id]
            if dev["status"] == "threat" and dev["id"] not in self.quarantined_devices:
                dev["status"] = "online"

    def add_device(self, device_data: dict) -> Device:
        """Commission a new device into the network."""
        device_data["status"] = "online"
        device_data["allowed"] = device_data.get("allowed", True)
        
        # Auto-assign default protocol based on device type if not provided/None
        if not device_data.get("protocol"):
            dev_type = device_data.get("type", "sensors")
            if dev_type in ["sensors", "thermostat", "precision_manufacturing", "power"]:
                device_data["protocol"] = "MQTT"
            elif dev_type in ["lock", "lightbulb", "speaker"]:
                device_data["protocol"] = "CoAP"
            else:
                device_data["protocol"] = "HTTP"

        self.devices[device_data["id"]] = {
            **device_data,
            "normal_packet_rate": 3,
            "normal_payload_range": (10, 50),
        }
        logger.info(f"New device commissioned: {device_data['id']}")
        return Device(**device_data)

    def remove_device(self, device_id: str) -> bool:
        """Decommission a device from the network."""
        if device_id in self.devices:
            dev = self.devices.pop(device_id)
            self.quarantined_devices.discard(device_id)
            if dev.get("ip"):
                self.unblock_ip(dev["ip"])
            logger.info(f"Device decommissioned: {device_id}")
            return True
        return False

    def reset(self):
        """Reset network to initial state."""
        self.blocked_ips.clear()
        self.quarantined_devices.clear()
        self._initialize_devices()
        logger.info("Network reset to initial state")
