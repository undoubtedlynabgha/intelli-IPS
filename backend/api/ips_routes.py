"""
Intelli IPS — IPS Engine API Routes
Endpoints for alerts, metrics, logs, and real-time event streaming (SSE).
"""

import json
import asyncio
from datetime import datetime
from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse
from models.schemas import Alert, MetricsResponse, LogEntry, ChartDataPoint

router = APIRouter(prefix="/ips", tags=["IPS Engine"])


def get_app_state():
    from main import app_state
    return app_state


# ──────────────────────────────────────────────
# GET /ips/alerts
# ──────────────────────────────────────────────
@router.get("/alerts", response_model=list[Alert])
async def get_alerts(limit: int = Query(50, ge=1, le=500)):
    """Fetch the most recent IPS alerts."""
    state = get_app_state()
    alerts = state["alerts"][-limit:]
    alerts.reverse()  # newest first
    return alerts


# ──────────────────────────────────────────────
# GET /ips/alerts/stream (Server-Sent Events)
# ──────────────────────────────────────────────
@router.get("/alerts/stream")
async def stream_alerts():
    """
    Real-time alert stream using Server-Sent Events (SSE).
    The frontend can listen to this for live alert updates.
    """
    state = get_app_state()

    async def event_generator():
        last_count = len(state["alerts"])
        while True:
            current_count = len(state["alerts"])
            if current_count < last_count:
                last_count = current_count
            elif current_count > last_count:
                # Send new alerts
                new_alerts = state["alerts"][last_count:current_count]
                for alert in new_alerts:
                    data = alert.model_dump_json()
                    yield f"data: {data}\n\n"
                last_count = current_count

            # Also send periodic heartbeat
            yield f": heartbeat\n\n"
            await asyncio.sleep(1)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )


# ──────────────────────────────────────────────
# GET /ips/metrics
# ──────────────────────────────────────────────
@router.get("/metrics", response_model=MetricsResponse)
async def get_metrics():
    """
    Return system-wide IPS metrics including throughput, 
    blocked IPs, detection rates, and device statuses.
    """
    state = get_app_state()
    detector = state["detector"]
    network = state["network"]
    mitigator = state["mitigator"]

    blocked_count = sum(
        1 for a in state["alerts"] 
        if a.actionTaken and a.actionTaken.value == "blocked"
    )
    prevented_count = sum(
        1 for a in state["alerts"] 
        if a.actionTaken and a.actionTaken.value == "prevented"
    )

    return MetricsResponse(
        simulation_running=state["running"],
        total_packets=state["total_packets"],
        total_alerts=len(state["alerts"]),
        total_blocked=blocked_count,
        total_prevented=prevented_count,
        blocked_ips=list(network.blocked_ips),
        quarantined_devices=list(network.quarantined_devices),
        packets_per_second=state.get("pps", 0),
        detection_rate=detector.get_detection_rate(),
        false_positive_rate=detector.get_false_positive_rate(),
        devices=network.get_all_devices(),
        active_attack=state["attack_simulator"].active_attack,
        ml_model_trained=detector.ml_detector.is_trained,
    )


# ──────────────────────────────────────────────
# GET /ips/logs
# ──────────────────────────────────────────────
@router.get("/logs", response_model=list[LogEntry])
async def get_logs(limit: int = Query(50, ge=1, le=500)):
    """Fetch the most recent system event logs."""
    state = get_app_state()
    logs = state["logs"][-limit:]
    logs.reverse()
    return logs


# ──────────────────────────────────────────────
# GET /ips/logs/stream (SSE for logs)
# ──────────────────────────────────────────────
@router.get("/logs/stream")
async def stream_logs():
    """Real-time log stream via Server-Sent Events."""
    state = get_app_state()

    async def event_generator():
        last_count = len(state["logs"])
        while True:
            current_count = len(state["logs"])
            if current_count < last_count:
                last_count = current_count
            elif current_count > last_count:
                new_logs = state["logs"][last_count:current_count]
                for log in new_logs:
                    data = log.model_dump_json()
                    yield f"data: {data}\n\n"
                last_count = current_count
            yield f": heartbeat\n\n"
            await asyncio.sleep(1)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )


# ──────────────────────────────────────────────
# GET /ips/traffic-chart
# ──────────────────────────────────────────────
@router.get("/traffic-chart", response_model=list[ChartDataPoint])
async def get_traffic_chart():
    """
    Return traffic volume data points for the dashboard chart.
    Aggregated from the rolling traffic history.
    """
    state = get_app_state()
    return state.get("traffic_chart", [])


# ──────────────────────────────────────────────
# POST /ips/reset
# ──────────────────────────────────────────────
@router.post("/reset")
async def reset_ips():
    """Reset all IPS state: alerts, logs, blocked IPs, ML model."""
    state = get_app_state()
    state["alerts"].clear()
    state["logs"].clear()
    state["total_packets"] = 0
    state["uptime"] = 0
    state["traffic_chart"] = []
    state["detector"].reset()
    state["mitigator"].reset()
    state["network"].reset()
    state["attack_simulator"].stop_attack()
    state["baseline_trained"] = False
    return {"status": "reset_complete"}


# ──────────────────────────────────────────────
# POST /ips/clear-logs
# ──────────────────────────────────────────────
@router.post("/clear-logs")
async def clear_logs():
    """Clear only logs and alerts. Leaves device registry, blocked IPs, and ML model baseline intact."""
    import uuid
    state = get_app_state()
    state["alerts"].clear()
    state["logs"].clear()
    
    # Reset detector stats but not baseline training
    state["detector"]._packet_counts.clear()
    state["detector"]._auth_attempts.clear()
    state["detector"]._sensor_history.clear()
    state["detector"].total_inspected = 0
    state["detector"].total_flagged = 0
    state["detector"].true_positives = 0
    state["detector"].false_positives = 0
    
    state["mitigator"].dropped_packets = 0
    state["mitigator"].mitigation_log.clear()
    
    # Log the clear event
    state["logs"].append(LogEntry(
        id=f"LOG-{uuid.uuid4().hex[:8]}",
        timestamp=datetime.now().strftime("%H:%M:%S"),
        source="SYSTEM",
        category="SYSTEM",
        message="IPS activity logs and alerts cleared by user.",
        status="SUCCESS",
    ))
    return {"status": "clear_complete"}

