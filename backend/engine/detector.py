"""
Intelli IPS — Hybrid Detection Engine
Combines signature-based and anomaly-based (ML) detection for threat identification.
"""

import logging
import uuid
from datetime import datetime
from collections import defaultdict, deque
from typing import Optional

from models.schemas import (
    TrafficPacket, Alert, RiskLevel, ActionTaken, DetectionMethod
)
from engine.ml_model import AnomalyDetector
from config import (
    DOS_PACKET_THRESHOLD,
    BRUTE_FORCE_ATTEMPT_THRESHOLD,
    BRUTE_FORCE_WINDOW_SECONDS,
    SPOOFING_VALUE_DEVIATION,
)

logger = logging.getLogger("intelli_ips.detector")


class DetectionEngine:
    """
    Hybrid IPS detection combining:
      1. Signature-based: pattern/threshold matching for known attack vectors
      2. Anomaly-based: Isolation Forest ML model for unknown threats
    """

    def __init__(self):
        self.ml_detector = AnomalyDetector()

        # Signature detection state
        self._packet_counts: dict[str, deque] = defaultdict(lambda: deque(maxlen=200))
        self._auth_attempts: dict[str, list[float]] = defaultdict(list)
        self._sensor_history: dict[str, deque] = defaultdict(lambda: deque(maxlen=50))

        # Statistics
        self.total_inspected: int = 0
        self.total_flagged: int = 0
        self.true_positives: int = 0
        self.false_positives: int = 0
        self.total_malicious: int = 0

    def inspect_packet(self, packet: TrafficPacket, device_baseline_rate: float = 5.0) -> Optional[Alert]:
        """
        Run a packet through the full detection pipeline.
        Returns an Alert if a threat is detected, None otherwise.
        """
        self.total_inspected += 1
        if packet.is_malicious:
            self.total_malicious += 1

        # ─── Stage 1: Signature-Based Detection ─────────
        alert = self._check_dos_signature(packet)
        if alert:
            self._update_stats(packet, True)
            return alert

        alert = self._check_brute_force_signature(packet)
        if alert:
            self._update_stats(packet, True)
            return alert

        alert = self._check_spoofing_signature(packet)
        if alert:
            self._update_stats(packet, True)
            return alert

        # ─── Stage 2: ML Anomaly Detection ───────────────
        alert = self._check_ml_anomaly(packet, device_baseline_rate)
        if alert:
            self._update_stats(packet, True)
            return alert

        # ─── No Threat Detected ──────────────────────────
        # Feed normal packets back to ML model for learning
        if not packet.is_malicious:
            self.ml_detector.incremental_update(packet, device_baseline_rate)
        self._update_stats(packet, False)
        return None

    # ════════════════════════════════════════════════
    # Signature-Based Detectors
    # ════════════════════════════════════════════════

    def _check_dos_signature(self, packet: TrafficPacket) -> Optional[Alert]:
        """
        Detect DoS by monitoring packet rate per source IP.
        If a single source exceeds the threshold, flag it.
        """
        src = packet.source_ip
        now = datetime.now().timestamp()
        self._packet_counts[src].append(now)

        # Count packets in the last second
        recent = [t for t in self._packet_counts[src] if now - t < 1.0]
        if len(recent) >= DOS_PACKET_THRESHOLD:
            protocol = packet.protocol
            return Alert(
                id=f"ALT-{uuid.uuid4().hex[:6].upper()}",
                risk=RiskLevel.CRITICAL,
                timestamp=datetime.now().strftime("%H:%M:%S"),
                device=packet.source_device_id,
                deviceId=packet.source_device_id,
                threat=f"{protocol} Flood Attack (DoS)",
                assessment="Rate Exceeded",
                confidence=98,
                description=(
                    f"Source {src} is sending {len(recent)} packets/sec via {protocol}, "
                    f"exceeding threshold of {DOS_PACKET_THRESHOLD}. "
                    f"Pattern consistent with {'MQTT broker flooding' if protocol == 'MQTT' else 'CoAP amplification'}."
                ),
                tags=["DoS", protocol, "Flood"],
                actionTaken=ActionTaken.PREVENTED,
                detectionMethod=DetectionMethod.SIGNATURE,
                source_ip=src,
            )
        return None

    def _check_brute_force_signature(self, packet: TrafficPacket) -> Optional[Alert]:
        """
        Detect brute-force by counting AUTH-type packets within a time window.
        """
        if packet.packet_type != "AUTH":
            return None

        src = packet.source_ip
        now = datetime.now().timestamp()
        self._auth_attempts[src].append(now)

        # Prune old attempts outside the window
        self._auth_attempts[src] = [
            t for t in self._auth_attempts[src]
            if now - t < BRUTE_FORCE_WINDOW_SECONDS
        ]

        if len(self._auth_attempts[src]) >= BRUTE_FORCE_ATTEMPT_THRESHOLD:
            return Alert(
                id=f"ALT-{uuid.uuid4().hex[:6].upper()}",
                risk=RiskLevel.CRITICAL,
                timestamp=datetime.now().strftime("%H:%M:%S"),
                device=packet.source_device_id,
                deviceId=packet.source_device_id,
                threat="Brute-Force Authentication Attempt",
                assessment="Auth Anomaly",
                confidence=96,
                description=(
                    f"Detected {len(self._auth_attempts[src])} authentication attempts from {src} "
                    f"within {BRUTE_FORCE_WINDOW_SECONDS}s window. "
                    f"Pattern matches credential stuffing / brute-force attack."
                ),
                tags=["Brute Force", "Auth", "Credential Stuffing"],
                actionTaken=ActionTaken.BLOCKED,
                detectionMethod=DetectionMethod.SIGNATURE,
                source_ip=src,
            )
        return None

    def _check_spoofing_signature(self, packet: TrafficPacket) -> Optional[Alert]:
        """
        Detect data spoofing via Z-score analysis on sensor values.
        A sensor reporting values wildly outside its historical norm triggers an alert.
        """
        if packet.sensor_value is None:
            return None

        dev_id = packet.source_device_id
        history = self._sensor_history[dev_id]
        history.append(packet.sensor_value)

        if len(history) < 10:
            return None  # need baseline data first

        import numpy as np
        values = list(history)
        mean = np.mean(values[:-1])  # exclude current
        std = np.std(values[:-1])

        if std == 0:
            return None

        z_score = abs((packet.sensor_value - mean) / std)

        if z_score >= SPOOFING_VALUE_DEVIATION:
            return Alert(
                id=f"ALT-{uuid.uuid4().hex[:6].upper()}",
                risk=RiskLevel.HIGH,
                timestamp=datetime.now().strftime("%H:%M:%S"),
                device=dev_id,
                deviceId=dev_id,
                threat="Sensor Data Spoofing Detected",
                assessment="Value Anomaly",
                confidence=min(99, int(60 + z_score * 5)),
                description=(
                    f"Device {dev_id} reported sensor value {packet.sensor_value:.2f}, "
                    f"which is {z_score:.1f} standard deviations from mean ({mean:.2f}). "
                    f"Likely data injection or sensor compromise."
                ),
                tags=["Spoofing", "Data Injection", "Anomaly"],
                actionTaken=ActionTaken.DETECTED,
                detectionMethod=DetectionMethod.STATISTICAL,
                source_ip=packet.source_ip,
            )
        return None

    # ════════════════════════════════════════════════
    # ML Anomaly Detection
    # ════════════════════════════════════════════════

    def _check_ml_anomaly(self, packet: TrafficPacket, device_baseline_rate: float) -> Optional[Alert]:
        """
        Run packet through the Isolation Forest model.
        Only triggers if the model is trained and predicts anomaly.
        """
        is_anomaly, confidence = self.ml_detector.predict(packet, device_baseline_rate)

        if is_anomaly and confidence >= 60:
            return Alert(
                id=f"ALT-{uuid.uuid4().hex[:6].upper()}",
                risk=RiskLevel.ANOMALY if confidence < 80 else RiskLevel.WARNING,
                timestamp=datetime.now().strftime("%H:%M:%S"),
                device=packet.source_device_id,
                deviceId=packet.source_device_id,
                threat="ML Anomaly Detection — Unusual Behavior",
                assessment="AI Flagged",
                confidence=confidence,
                description=(
                    f"Isolation Forest model flagged traffic from {packet.source_ip} "
                    f"({packet.protocol}/{packet.packet_type}, {packet.payload_size}B) "
                    f"as anomalous with {confidence}% confidence. "
                    f"Behavior deviates from learned baseline."
                ),
                tags=["ML Detection", "Anomaly", "Isolation Forest"],
                actionTaken=ActionTaken.DETECTED,
                detectionMethod=DetectionMethod.ANOMALY_ML,
                source_ip=packet.source_ip,
            )
        return None

    # ════════════════════════════════════════════════
    # Helpers
    # ════════════════════════════════════════════════

    def _update_stats(self, packet: TrafficPacket, was_flagged: bool):
        """Update detection statistics for metrics reporting."""
        if was_flagged:
            self.total_flagged += 1
            if packet.is_malicious:
                self.true_positives += 1
            else:
                self.false_positives += 1

    def get_detection_rate(self) -> float:
        """Percentage of malicious packets correctly identified."""
        if self.total_malicious == 0:
            return 0.0
        return round((self.true_positives / self.total_malicious) * 100, 2)

    def get_false_positive_rate(self) -> float:
        """Percentage of normal packets incorrectly flagged."""
        total_normal = self.total_inspected - self.total_malicious
        if total_normal == 0:
            return 0.0
        return round((self.false_positives / total_normal) * 100, 2)

    def train_ml_model(self, normal_packets: list, device_baselines: dict[str, float] = None):
        """Explicitly train the ML model with baseline normal traffic."""
        self.ml_detector.train(normal_packets, device_baselines)

    def reset(self):
        """Reset all detection state."""
        self._packet_counts.clear()
        self._auth_attempts.clear()
        self._sensor_history.clear()
        self.total_inspected = 0
        self.total_flagged = 0
        self.true_positives = 0
        self.false_positives = 0
        self.total_malicious = 0
        self.ml_detector.reset()
        logger.info("Detection engine reset")
