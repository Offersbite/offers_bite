from datetime import datetime, timezone
from typing import Annotated, Any

from fastapi import Depends, HTTPException, Request

from app.core.config import COOKIE_NAME
from app.core.security import hash_session_token
from app.db.mongo import sessions, users


def get_current_user(request: Request) -> dict[str, Any]:
    raw_token = request.cookies.get(COOKIE_NAME)
    if not raw_token:
        raise HTTPException(status_code=401, detail="Authentication required")

    session = sessions.find_one(
        {
            "tokenHash": hash_session_token(raw_token),
            "expiresAt": {"$gt": datetime.now(timezone.utc)},
        }
    )
    if not session:
        raise HTTPException(status_code=401, detail="Session expired or invalid")

    user = users.find_one({"_id": session["userId"]})
    if not user or not user.get("emailVerifiedAt") or user.get("isActive", True) is False:
        raise HTTPException(status_code=401, detail="Session expired or invalid")
    return user


CurrentUser = Annotated[dict[str, Any], Depends(get_current_user)]


def get_admin_user(user: CurrentUser) -> dict[str, Any]:
    if user.get("role", "user") != "admin":
        raise HTTPException(status_code=403, detail="Administrator access required")
    return user


AdminUser = Annotated[dict[str, Any], Depends(get_admin_user)]
