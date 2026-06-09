"""
Intelli IPS — Machine Learning Anomaly Detector
Lightweight Isolation Forest model for unsupervised anomaly detection on IoT traffic.
"""

import numpy as np
import logging
from collections import deque
from sklearn.ensemble import IsolationForest
from config import ANOMALY_CONTAMINATION, ML_FEATURE_WINDOW, ANOMALY_RETRAIN_INTERVAL

logger = logging.getLogger("intelli_ips.ml_model")


class AnomalyDetector:
    """
    Uses Isolation Forest for unsupervised anomaly detection.
    
    Features extracted per packet:
        1. payload_size         — raw byte size
        2. sensor_value         — reported sensor reading (0 if N/A)
        3. packet_rate_ratio    — current rate vs. device baseline
        4. protocol_encoded     — numerical encoding of protocol
        5. packet_type_encoded  — numerical encoding of packet type
    
    The model is trained on normal traffic during the baseline phase,
    then used to score incoming packets during the detection phase.
    """

    PROTOCOL_MAP = {"MQTT": 0, "CoAP": 1, "HTTP": 2}
    PACKET_TYPE_MAP = {
        "DATA": 0, "PUBLISH": 1, "SUBSCRIBE": 2, "CONNECT": 3,
        "PINGREQ": 4, "DISCONNECT": 5, "GET": 6, "PUT": 7,
        "POST": 8, "OBSERVE": 9, "HEAD": 10, "AUTH": 11,
    }

    def __init__(self):
        self.model: IsolationForest = IsolationForest(
            contamination=ANOMALY_CONTAMINATION,
            n_estimators=100,
            random_state=42,
            warm_start=False,
        )
        self.is_trained: bool = False
        self.training_buffer: list[np.ndarray] = []
        self.min_training_samples: int = ML_FEATURE_WINDOW
        self.samples_since_retrain: int = 0
        self._device_rates: dict[str, deque] = {}  # track per-device packet counts
        self.feature_means: np.ndarray = np.array([50.0, 20.0, 1.0, 1.0, 1.0])
        self.feature_stds: np.ndarray = np.array([20.0, 5.0, 0.5, 0.5, 0.5])

    def extract_features(self, packet, device_baseline_rate: float = 5.0) -> np.ndarray:
        """Extract a numerical feature vector from a traffic packet."""
        import time
        payload = packet.payload_size
        sensor = packet.sensor_value if packet.sensor_value is not None else 0.0
        protocol_enc = self.PROTOCOL_MAP.get(packet.protocol, 2)
        ptype_enc = self.PACKET_TYPE_MAP.get(packet.packet_type, 0)

        # Track per-device packet rate
        dev_id = packet.source_device_id
        now = time.time()
        if dev_id not in self._device_rates:
            self._device_rates[dev_id] = deque(maxlen=200)
        self._device_rates[dev_id].append(now)
        
        # Count packets in the last 1.0 second
        recent = [t for t in self._device_rates[dev_id] if now - t < 1.0]
        current_rate = len(recent)
        rate_ratio = current_rate / max(device_baseline_rate, 1.0)

        return np.array([payload, sensor, rate_ratio, protocol_enc, ptype_enc])

    def train(self, normal_packets: list, device_baselines: dict[str, float] = None):
        """
        Train (or retrain) the Isolation Forest on normal traffic features.
        Called during the baseline phase with only verified-normal packets.
        """
        if not normal_packets:
            return

        baselines = device_baselines or {}
        features = []
        for pkt in normal_packets:
            rate = baselines.get(pkt.source_device_id, 5.0)
            feat = self.extract_features(pkt, rate)
            features.append(feat)

        X = np.array(features)
        if len(X) < self.min_training_samples:
            # Buffer until we have enough samples
            self.training_buffer.extend(features)
            if len(self.training_buffer) >= self.min_training_samples:
                X = np.array(self.training_buffer)
                self.model.fit(X)
                self.feature_means = np.mean(X, axis=0)
                self.feature_stds = np.std(X, axis=0)
                self.is_trained = True
                self.training_buffer.clear()
                logger.info(f"ML Model trained on {len(X)} samples")
            return

        self.model.fit(X)
        self.feature_means = np.mean(X, axis=0)
        self.feature_stds = np.std(X, axis=0)
        self.is_trained = True
        self.samples_since_retrain = 0
        logger.info(f"ML Model trained on {len(X)} samples")

    def get_feature_contributions(self, features: np.ndarray) -> dict[str, float]:
        """Calculate explanation contributions for the feature dimensions."""
        if not self.is_trained or not hasattr(self, "feature_means"):
            return {
                "payload_size": 20.0,
                "sensor_value": 20.0,
                "packet_rate": 20.0,
                "protocol": 20.0,
                "packet_type": 20.0
            }
        
        # Scale deviations by historical standard deviation
        deviations = np.abs(features - self.feature_means) / np.maximum(self.feature_stds, 1e-5)
        names = ["payload_size", "sensor_value", "packet_rate", "protocol", "packet_type"]
        
        total_dev = np.sum(deviations)
        if total_dev == 0:
            return {name: 20.0 for name in names}
            
        contributions = {}
        for name, dev in zip(names, deviations):
            contributions[name] = round((dev / total_dev) * 100, 1)
            
        return contributions

    def predict(self, packet, device_baseline_rate: float = 5.0) -> tuple[bool, float, dict[str, float]]:
        """
        Predict whether a packet is anomalous.
        
        Returns:
            (is_anomaly: bool, anomaly_score: float, contributions: dict[str, float])
        """
        if not self.is_trained:
            return False, 0.0, {}

        features = self.extract_features(packet, device_baseline_rate)
        features_reshaped = features.reshape(1, -1)
        prediction = self.model.predict(features_reshaped)[0]  # 1 = normal, -1 = anomaly
        score = self.model.score_samples(features_reshaped)[0]  # negative = more anomalous

        is_anomaly = prediction == -1
        # Convert IsolationForest score to a clean 0-100 confidence.
        # score is typically between -1.0 and 0.0, with -0.5 being the boundary.
        if is_anomaly:
            # Map score range [-1.0, -0.5] -> [60%, 98%]
            confidence = int(60 + ((-score) - 0.5) * 76)
        else:
            # Map score range (-0.5, 0.0] -> [0%, 50%]
            confidence = int(max(0, 50 - (score + 0.5) * 100))
            
        confidence = max(0, min(100, confidence))
        contributions = self.get_feature_contributions(features)
        return is_anomaly, confidence, contributions

    def incremental_update(self, normal_packet, device_baseline_rate: float = 5.0):
        """
        Buffer normal packets for periodic retraining.
        The model retrains after accumulating enough new samples.
        """
        feat = self.extract_features(normal_packet, device_baseline_rate)
        self.training_buffer.append(feat)
        self.samples_since_retrain += 1

        if self.samples_since_retrain >= ANOMALY_RETRAIN_INTERVAL and len(self.training_buffer) >= self.min_training_samples:
            X = np.array(self.training_buffer[-ANOMALY_RETRAIN_INTERVAL * 2:])
            self.model.fit(X)
            self.feature_means = np.mean(X, axis=0)
            self.feature_stds = np.std(X, axis=0)
            self.samples_since_retrain = 0
            logger.info(f"ML Model retrained with {len(X)} samples")

    def reset(self):
        """Reset the model to untrained state."""
        self.is_trained = False
        self.training_buffer.clear()
        self.samples_since_retrain = 0
        self._device_rates.clear()
        self.feature_means = np.array([50.0, 20.0, 1.0, 1.0, 1.0])
        self.feature_stds = np.array([20.0, 5.0, 0.5, 0.5, 0.5])
        self.model = IsolationForest(
            contamination=ANOMALY_CONTAMINATION,
            n_estimators=100,
            random_state=42,
        )
        logger.info("ML Model reset")
