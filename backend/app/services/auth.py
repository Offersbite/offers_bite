import secrets
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import uuid4

from bson import ObjectId
from fastapi import HTTPException, Response
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError
from pwdlib import PasswordHash

from app.core.config import (
    COOKIE_NAME,
    COOKIE_SECURE,
    OTP_EXPIRY_SECONDS,
    OTP_MAX_ATTEMPTS,
    OTP_RESEND_INTERVAL_SECONDS,
    OTP_HASH_SECRET,
    SESSION_DURATION_SECONDS,
)
from app.core.security import hash_email_otp, hash_session_token, verify_email_otp
from app.db.mongo import pending_registrations, sessions, users
from app.services.email import EmailDeliveryError, send_verification_otp


password_hasher = PasswordHash.recommended()


def hash_password(password: str) -> str:
    return password_hasher.hash(password)


def public_user(user: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(user["_id"]),
        "name": user["name"],
        "email": user["email"],
        "created_at": user["createdAt"],
        "role": user.get("role", "user"),
        "is_active": user.get("isActive", True),
    }


def create_session(user_id: ObjectId, response: Response) -> None:
    raw_token = secrets.token_urlsafe(32)
    now = datetime.now(timezone.utc)
    sessions.insert_one(
        {
            "tokenHash": hash_session_token(raw_token),
            "userId": user_id,
            "createdAt": now,
            "expiresAt": now + timedelta(seconds=SESSION_DURATION_SECONDS),
        }
    )
    response.set_cookie(
        key=COOKIE_NAME,
        value=raw_token,
        max_age=SESSION_DURATION_SECONDS,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="lax",
        path="/",
    )


def issue_email_otp(
    email: str,
    name: str,
    password_hash: str,
    user_id: ObjectId | None = None,
) -> None:
    if len(OTP_HASH_SECRET) < 32:
        raise HTTPException(
            status_code=503,
            detail="Email verification is not configured on the server.",
        )

    now = datetime.now(timezone.utc)
    current = pending_registrations.find_one({"email": email})
    if current and current["resendAvailableAt"] > now:
        raise HTTPException(
            status_code=429,
            detail="Please wait before requesting another verification code.",
        )

    otp = f"{secrets.randbelow(10000):04d}"
    salt = secrets.token_urlsafe(16)
    challenge_id = str(uuid4())
    pending = {
        "email": email,
        "name": name,
        "passwordHash": password_hash,
        "userId": user_id,
        "otpHash": hash_email_otp(email, otp, salt),
        "otpSalt": salt,
        "attemptsRemaining": OTP_MAX_ATTEMPTS,
        "challengeId": challenge_id,
        "createdAt": now,
        "expiresAt": now + timedelta(seconds=OTP_EXPIRY_SECONDS),
        "resendAvailableAt": now + timedelta(seconds=OTP_RESEND_INTERVAL_SECONDS),
    }
    pending_registrations.replace_one({"email": email}, pending, upsert=True)

    try:
        send_verification_otp(email, otp)
    except EmailDeliveryError as exc:
        pending_registrations.delete_one(
            {"email": email, "challengeId": challenge_id}
        )
        raise HTTPException(status_code=503, detail=str(exc)) from exc


def verify_registration(email: str, otp: str) -> dict[str, Any]:
    pending = pending_registrations.find_one({"email": email})
    now = datetime.now(timezone.utc)
    if not pending or pending["expiresAt"] <= now:
        if pending:
            pending_registrations.delete_one({"_id": pending["_id"]})
        raise HTTPException(
            status_code=400,
            detail="Verification code expired or is invalid. Request a new code.",
        )

    if not verify_email_otp(email, otp, pending["otpSalt"], pending["otpHash"]):
        if pending["attemptsRemaining"] <= 1:
            pending_registrations.delete_one({"_id": pending["_id"]})
            raise HTTPException(
                status_code=400,
                detail="Too many incorrect codes. Request a new verification code.",
            )
        pending_registrations.update_one(
            {"_id": pending["_id"]}, {"$inc": {"attemptsRemaining": -1}}
        )
        raise HTTPException(status_code=400, detail="Invalid verification code.")

    user = None
    if pending.get("userId"):
        user = users.find_one_and_update(
            {"_id": pending["userId"]},
            {
                "$set": {
                    "emailVerifiedAt": now,
                    "updatedAt": now,
                }
            },
            return_document=ReturnDocument.AFTER,
        )
    if not user:
        user_document = {
            "name": pending["name"],
            "email": email,
            "passwordHash": pending["passwordHash"],
            "emailVerifiedAt": now,
            "createdAt": now,
            "updatedAt": now,
            "role": "user",
            "isActive": True,
            "wallet_cards": [],
        }
        try:
            result = users.insert_one(user_document)
        except DuplicateKeyError as exc:
            raise HTTPException(
                status_code=409,
                detail="An account with this email already exists.",
            ) from exc
        user_document["_id"] = result.inserted_id
        user = user_document

    pending_registrations.delete_one({"_id": pending["_id"]})
    return user


def authenticate(email: str, password: str) -> dict[str, Any]:
    user = users.find_one({"email": email})
    if (
        not user
        or not user.get("passwordHash")
        or not password_hasher.verify(password, user["passwordHash"])
    ):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if user.get("isActive", True) is False:
        raise HTTPException(status_code=403, detail="This account has been deactivated.")
    if not user.get("emailVerifiedAt"):
        raise HTTPException(
            status_code=403,
            detail="Verify your email before signing in. Request a verification code to continue.",
        )
    return user
