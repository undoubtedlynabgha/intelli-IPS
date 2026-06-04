"""
Intelli IPS — Mitigation Engine
Executes prevention actions when threats are detected: drop, block, quarantine.
"""

import logging
from typing import Optional
from datetime import datetime
from models.schemas import Alert, LogEntry, ActionTaken, RiskLevel

logger = logging.getLogger("intelli_ips.mitigator")


class Mitigator:
    """
    Takes mitigation actions based on detected alerts.
    Coordinates with the IoT network to block IPs, quarantine devices,
    and generate structured log entries.
    """

    def __init__(self, network):
        """
        Args:
            network: IoTNetwork instance to execute actions on
        """
        self.network = network
        self.dropped_packets: int = 0
        self.mitigation_log: list[LogEntry] = []

    def mitigate(self, alert: Alert) -> list[LogEntry]:
        """
        Execute appropriate mitigation based on the alert severity and type.
        
        Mitigation hierarchy:
            CRITICAL → Block IP + Quarantine device + Drop packets
            HIGH     → Block IP + Drop packets
            WARNING  → Log + Flag device as threat
            INFO/ANOMALY → Log only
        
        Returns:
            List of LogEntry records documenting the actions taken.
        """
        logs = []
        now = datetime.now().strftime("%H:%M:%S")

        # ─── CRITICAL: Full prevention ───────────────────
        if alert.risk == RiskLevel.CRITICAL:
            # Drop packets
            self.dropped_packets += 1
            logs.append(self._log(
                now, alert.deviceId, "MITIGATION",
                f"Intelli IPS: Dropped malicious packets from {alert.source_ip or alert.deviceId}. "
                f"Threat: {alert.threat}",
                "BLOCKED"
            ))

            # Block attacker IP
            if alert.source_ip:
                blocked = self.network.block_ip(alert.source_ip)
                if blocked:
                    logs.append(self._log(
                        now, "IPS_ENGINE", "MITIGATION",
                        f"IP {alert.source_ip} added to block list. All future traffic will be dropped.",
                        "BLOCKED"
                    ))

            # Quarantine internal compromised devices only (not external attackers)
            external_prefixes = ("10.99", "172.16.66", "203.0.113")
            is_external = (
                alert.deviceId == "EXTERNAL"
                or (alert.source_ip and alert.source_ip.startswith(external_prefixes))
            )
            if alert.source_ip and not is_external:
                quarantined = self.network.quarantine_device(alert.deviceId)
                if quarantined:
                    logs.append(self._log(
                        now, alert.deviceId, "MITIGATION",
                        f"Device {alert.deviceId} quarantined. Isolated from mesh network.",
                        "BLOCKED"
                    ))

            alert.actionTaken = ActionTaken.BLOCKED

        # ─── HIGH: Block and drop ────────────────────────
        elif alert.risk == RiskLevel.HIGH:
            self.dropped_packets += 1
            if alert.source_ip:
                self.network.block_ip(alert.source_ip)
            self.network.set_device_threat(alert.deviceId)

            logs.append(self._log(
                now, alert.deviceId, "MITIGATION",
                f"Intelli IPS: Blocked traffic from {alert.source_ip or alert.deviceId}. "
                f"Confidence: {alert.confidence}%. Detection: {alert.detectionMethod}",
                "BLOCKED"
            ))
            alert.actionTaken = ActionTaken.PREVENTED

        # ─── WARNING: Flag and monitor ───────────────────
        elif alert.risk == RiskLevel.WARNING:
            self.network.set_device_threat(alert.deviceId)
            logs.append(self._log(
                now, alert.deviceId, "NETWORK",
                f"WARNING: {alert.threat} from {alert.deviceId}. Under increased monitoring.",
                "WARNING"
            ))
            alert.actionTaken = ActionTaken.DETECTED

        # ─── INFO / ANOMALY: Log only ────────────────────
        else:
            logs.append(self._log(
                now, alert.deviceId, "NETWORK",
                f"Anomaly detected: {alert.threat}. Confidence: {alert.confidence}%.",
                "INFO"
            ))
            alert.actionTaken = ActionTaken.DETECTED

        self.mitigation_log.extend(logs)
        return logs

    def _log(self, timestamp: str, source: str, category: str, message: str, status: str) -> LogEntry:
        """Create a structured log entry."""
        import uuid
        return LogEntry(
            id=f"LOG-{uuid.uuid4().hex[:8]}",
            timestamp=timestamp,
            source=source,
            category=category,
            message=message,
            status=status,
        )

    def get_recent_logs(self, limit: int = 50) -> list[LogEntry]:
        """Return the most recent mitigation logs."""
        return self.mitigation_log[-limit:]

    def reset(self):
        """Reset mitigation state."""
        self.dropped_packets = 0
        self.mitigation_log.clear()
        logger.info("Mitigator reset")
