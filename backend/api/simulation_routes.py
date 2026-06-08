"""
Intelli IPS — Simulation API Routes
Handles starting/stopping the simulation and triggering attacks.
"""

from fastapi import APIRouter, HTTPException
from models.schemas import AttackRequest, SimulationStatus, AttackType

router = APIRouter(prefix="/simulation", tags=["Simulation"])


def get_app_state():
    """Get the shared application state — injected at startup."""
    from main import app_state
    return app_state


# ──────────────────────────────────────────────
# POST /simulation/start
# ──────────────────────────────────────────────
@router.post("/start", response_model=SimulationStatus)
async def start_simulation():
    """Start the IoT network simulation and traffic generation."""
    state = get_app_state()

    if state["running"]:
        raise HTTPException(status_code=400, detail="Simulation is already running")

    # Cancel any previously existing task cleanly before creating a new one.
    # This is the key fix for the re-run bug: the old cancelled task may still
    # exist as an object and was preventing baseline reset.
    if state.get("sim_task") is not None:
        old_task = state["sim_task"]
        if not old_task.done():
            old_task.cancel()
            try:
                import asyncio
                await asyncio.shield(asyncio.wait_for(old_task, timeout=1.0))
            except Exception:
                pass
        state["sim_task"] = None

    # Always reset baseline so ML re-trains on fresh normal traffic each run
    state["baseline_trained"] = False

    state["running"] = True
    import asyncio
    from main import simulation_loop
    state["sim_task"] = asyncio.create_task(simulation_loop())

    return SimulationStatus(
        running=True,
        uptime_seconds=0,
        total_packets_generated=state["total_packets"],
        total_attacks_injected=state["attack_simulator"].total_attacks_injected,
        active_attack=state["attack_simulator"].active_attack,
    )


# ──────────────────────────────────────────────
# POST /simulation/stop
# ──────────────────────────────────────────────
@router.post("/stop", response_model=SimulationStatus)
async def stop_simulation():
    """Stop the simulation and freeze all traffic."""
    state = get_app_state()

    if not state["running"]:
        raise HTTPException(status_code=400, detail="Simulation is not running")

    state["running"] = False
    # Stop any active attack
    state["attack_simulator"].stop_attack()
    for dev_id in list(state["network"].devices.keys()):
        state["network"].clear_device_threat(dev_id)

    # Cancel simulation task
    if state.get("sim_task"):
        state["sim_task"].cancel()
        state["sim_task"] = None

    return SimulationStatus(
        running=False,
        uptime_seconds=state["uptime"],
        total_packets_generated=state["total_packets"],
        total_attacks_injected=state["attack_simulator"].total_attacks_injected,
        active_attack=None,
    )


# ──────────────────────────────────────────────
# POST /simulation/reset
# ──────────────────────────────────────────────
@router.post("/reset")
async def reset_simulation():
    """
    Fully reset the simulation: stop it, clear all state, reset network to defaults.
    Use this to get a completely clean slate for a new simulation run.
    """
    state = get_app_state()

    # Stop running simulation first
    if state["running"]:
        state["running"] = False
        state["attack_simulator"].stop_attack()

    if state.get("sim_task") is not None:
        old_task = state["sim_task"]
        if not old_task.done():
            old_task.cancel()
            try:
                import asyncio
                await asyncio.shield(asyncio.wait_for(old_task, timeout=1.0))
            except Exception:
                pass
        state["sim_task"] = None

    # Clear all accumulated data
    state["alerts"].clear()
    state["logs"].clear()
    state["total_packets"] = 0
    state["uptime"] = 0.0
    state["pps"] = 0.0
    state["traffic_chart"] = []
    state["start_time"] = None
    state["baseline_trained"] = False

    # Reset all subsystems
    state["detector"].reset()
    state["mitigator"].reset()
    state["network"].reset()
    state["attack_simulator"].stop_attack()
    state["attack_simulator"].total_attacks_injected = 0

    return {"status": "simulation_reset", "message": "Simulation fully reset. Ready for a fresh run."}


# ──────────────────────────────────────────────
# POST /simulation/attack
# ──────────────────────────────────────────────
@router.post("/attack")
async def trigger_attack(request: AttackRequest):
    """
    Inject a specific attack into the simulation.
    The attack will run for its configured duration then auto-stop.
    """
    state = get_app_state()

    if not state["running"]:
        raise HTTPException(status_code=400, detail="Start the simulation first before injecting attacks")

    if state["attack_simulator"].is_active():
        raise HTTPException(status_code=409, detail="An attack is already in progress. Wait for it to finish or stop the simulation.")

    # Find target device
    target = None
    if request.target_device_id:
        target = state["network"].get_device(request.target_device_id)
        if not target:
            raise HTTPException(status_code=404, detail=f"Device {request.target_device_id} not found")
    else:
        import random
        active = state["network"].get_active_devices()
        if active:
            target = random.choice(active)

    # Find attacker device (optional internal compromise)
    attacker = None
    if request.attacker_device_id:
        attacker = state["network"].get_device(request.attacker_device_id)
        if not attacker:
            raise HTTPException(status_code=404, detail=f"Attacker device {request.attacker_device_id} not found")

    state["attack_simulator"].start_attack(
        request.attack_type,
        target_device=target,
        attacker_device=attacker,
        custom_packet_rate=request.packet_rate
    )
    if target:
        state["network"].set_device_threat(target["id"])
    if attacker:
        state["network"].set_device_threat(attacker["id"])

    from config import ATTACK_CONFIGS
    config = ATTACK_CONFIGS.get(request.attack_type.value, {})

    return {
        "status": "attack_started",
        "attack_type": request.attack_type.value,
        "label": config.get("label", request.attack_type.value),
        "target_device": target.get("name") if target else "broadcast",
        "attacker_device": attacker.get("name") if attacker else "External Attacker",
        "duration_ticks": config.get("duration_ticks", 20),
    }


# ──────────────────────────────────────────────
# POST /simulation/attack/stop
# ──────────────────────────────────────────────
@router.post("/attack/stop")
async def stop_attack():
    """Manually stop the active attack."""
    state = get_app_state()
    state["attack_simulator"].stop_attack()
    for dev_id in list(state["network"].devices.keys()):
        state["network"].clear_device_threat(dev_id)
    return {"status": "attack_stopped"}


# ──────────────────────────────────────────────
# GET /simulation/status
# ──────────────────────────────────────────────
@router.get("/status", response_model=SimulationStatus)
async def get_status():
    """Get the current simulation status."""
    state = get_app_state()
    return SimulationStatus(
        running=state["running"],
        uptime_seconds=state["uptime"],
        total_packets_generated=state["total_packets"],
        total_attacks_injected=state["attack_simulator"].total_attacks_injected,
        active_attack=state["attack_simulator"].active_attack,
    )
