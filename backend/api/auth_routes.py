"""
Intelli IPS — Auth API Routes
Handles user login, registration, and session management.
Credentials are validated against the local file-based UserStore (users.json).
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import base64
import time

router = APIRouter(prefix="/auth", tags=["Auth"])


def get_user_store():
    from config import get_user_store as _get
    return _get()


# ──────────────────────────────────────────────
# Request / Response Models
# ──────────────────────────────────────────────
class LoginRequest(BaseModel):
    username: str
    password: str


class RegisterRequest(BaseModel):
    username: str
    password: str
    role: str = "user"  # "user" or "admin"


class TokenResponse(BaseModel):
    username: str
    role: str
    token: str  # simple base64 token: username:role:timestamp


def _make_token(username: str, role: str) -> str:
    """Create a simple non-cryptographic session token (base64 encoded)."""
    raw = f"{username}:{role}:{int(time.time())}"
    return base64.b64encode(raw.encode()).decode()


def _parse_token(token: str) -> Optional[dict]:
    """Parse token back into parts. Returns None if malformed."""
    try:
        decoded = base64.b64decode(token.encode()).decode()
        parts = decoded.split(":", 2)
        if len(parts) < 3:
            return None
        return {"username": parts[0], "role": parts[1], "issued_at": int(parts[2])}
    except Exception:
        return None


# ──────────────────────────────────────────────
# POST /auth/login
# ──────────────────────────────────────────────
@router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest):
    """Verify credentials and return a session token."""
    store = get_user_store()
    if not store.verify_credentials(req.username, req.password):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    user = store.get_user(req.username)
    role = user.get("role", "user")
    return TokenResponse(
        username=req.username,
        role=role,
        token=_make_token(req.username, role),
    )


# ──────────────────────────────────────────────
# POST /auth/register
# ──────────────────────────────────────────────
@router.post("/register", response_model=TokenResponse)
async def register(req: RegisterRequest):
    """
    Register a new user account.
    Role must be 'user' or 'admin'. Only pass 'admin' from a trusted admin context.
    """
    if req.role not in ("user", "admin"):
        raise HTTPException(status_code=400, detail="Role must be 'user' or 'admin'")
    store = get_user_store()
    if store.get_user(req.username):
        raise HTTPException(status_code=409, detail=f"Username '{req.username}' already exists")
    ok = store.add_user(req.username, req.password, req.role)
    if not ok:
        raise HTTPException(status_code=500, detail="Failed to create user")
    return TokenResponse(
        username=req.username,
        role=req.role,
        token=_make_token(req.username, req.role),
    )


# ──────────────────────────────────────────────
# POST /auth/logout
# ──────────────────────────────────────────────
@router.post("/logout")
async def logout():
    """
    Stateless logout. The client should clear its stored token.
    """
    return {"status": "logged_out", "message": "Session cleared. Goodbye."}


# ──────────────────────────────────────────────
# GET /auth/me
# ──────────────────────────────────────────────
@router.get("/me")
async def me(token: str):
    """
    Validate a token and return the session's user info.
    Pass token as a query param: GET /auth/me?token=<token>
    """
    parsed = _parse_token(token)
    if not parsed:
        raise HTTPException(status_code=401, detail="Invalid or malformed token")
    store = get_user_store()
    user = store.get_user(parsed["username"])
    if not user:
        raise HTTPException(status_code=404, detail="User no longer exists")
    return {
        "username": parsed["username"],
        "role": parsed["role"],
        "issued_at": parsed["issued_at"],
    }


# ──────────────────────────────────────────────
# GET /auth/users  (admin only — no enforcement here, client-gated)
# ──────────────────────────────────────────────
@router.get("/users")
async def list_users():
    """List all registered usernames and roles (passwords are never returned)."""
    store = get_user_store()
    users = store._load_users()
    return [{"username": u["username"], "role": u.get("role", "user")} for u in users]


# ──────────────────────────────────────────────
# DELETE /auth/users/{username}
# ──────────────────────────────────────────────
@router.delete("/users/{username}")
async def delete_user(username: str):
    """Delete a user account. Cannot delete the last admin."""
    store = get_user_store()
    users = store._load_users()
    target = store.get_user(username)
    if not target:
        raise HTTPException(status_code=404, detail=f"User '{username}' not found")
    # Prevent deleting last admin
    admins = [u for u in users if u.get("role") == "admin"]
    if target.get("role") == "admin" and len(admins) <= 1:
        raise HTTPException(status_code=400, detail="Cannot delete the last admin account")
    remaining = [u for u in users if u["username"] != username]
    store._save_users(remaining)
    return {"status": "deleted", "username": username}
