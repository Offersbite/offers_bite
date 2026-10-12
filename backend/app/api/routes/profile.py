from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException

from app.db.mongo import users
from app.dependencies.auth import CurrentUser
from app.schemas.profile import ProfileUpdate
from app.services.auth import public_user


router = APIRouter(prefix="/profile", tags=["profile"])


@router.get("")
def get_profile(user: CurrentUser) -> dict[str, Any]:
    return public_user(user)


@router.patch("")
def update_profile(profile: ProfileUpdate, user: CurrentUser) -> dict[str, Any]:
    updated_user = users.find_one_and_update(
        {"_id": user["_id"]},
        {
            "$set": {
                "name": profile.name,
                "updatedAt": datetime.now(timezone.utc),
            }
        },
        return_document=True,
    )
    if not updated_user:
        raise HTTPException(status_code=404, detail="Profile not found")
    return public_user(updated_user)
