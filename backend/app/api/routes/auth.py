from typing import Any

from fastapi import APIRouter, HTTPException, Request, Response

from app.core.config import COOKIE_NAME, COOKIE_SECURE
from app.core.security import hash_session_token
from app.db.mongo import pending_registrations, sessions, users
from app.dependencies.auth import CurrentUser
from app.schemas.auth import (
    AccountRegistration,
    LoginRequest,
    ResendOtpRequest,
    VerifyEmailRequest,
)
from app.services.auth import (
    authenticate,
    create_session,
    hash_password,
    issue_email_otp,
    public_user,
    verify_registration,
)


router = APIRouter(prefix="/auth", tags=["authentication"])


@router.post("/register", status_code=202)
def register(account: AccountRegistration) -> dict[str, str]:
    email = str(account.email).lower()
    if users.find_one({"email": email}, {"_id": 1}):
        raise HTTPException(
            status_code=409, detail="An account with this email already exists."
        )
    issue_email_otp(
        email=email,
        name=account.name,
        password_hash=hash_password(account.password),
    )
    return {"email": email, "message": "Verification code sent."}


@router.post("/verify-email")
def verify_email(payload: VerifyEmailRequest, response: Response) -> dict[str, Any]:
    user = verify_registration(str(payload.email).lower(), payload.otp)
    create_session(user["_id"], response)
    return public_user(user)


@router.post("/resend-verification", status_code=202)
def resend_verification(payload: ResendOtpRequest) -> dict[str, str]:
    email = str(payload.email).lower()
    existing = users.find_one({"email": email})
    pending = pending_registrations.find_one({"email": email})

    if existing and existing.get("emailVerifiedAt"):
        return {"message": "If verification is pending, a code will be sent."}
    if existing and not pending:
        if not existing.get("passwordHash"):
            return {"message": "If verification is pending, a code will be sent."}
        issue_email_otp(
            email=email,
            name=existing["name"],
            password_hash=existing["passwordHash"],
            user_id=existing["_id"],
        )
    elif pending:
        issue_email_otp(
            email=email,
            name=pending["name"],
            password_hash=pending["passwordHash"],
            user_id=pending.get("userId"),
        )
    return {"message": "If verification is pending, a code will be sent."}


@router.post("/login")
def login(credentials: LoginRequest, response: Response) -> dict[str, Any]:
    user = authenticate(str(credentials.email).lower(), credentials.password)
    create_session(user["_id"], response)
    return public_user(user)


@router.post("/logout", status_code=204)
def logout(request: Request, response: Response) -> Response:
    raw_token = request.cookies.get(COOKIE_NAME)
    if raw_token:
        sessions.delete_one({"tokenHash": hash_session_token(raw_token)})
    response.delete_cookie(
        key=COOKIE_NAME,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="lax",
        path="/",
    )
    response.status_code = 204
    return response


@router.get("/me")
def get_session_user(user: CurrentUser) -> dict[str, Any]:
    return public_user(user)
