import hashlib
import hmac

from app.core.config import OTP_HASH_SECRET


def hash_session_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def hash_email_otp(email: str, otp: str, salt: str) -> str:
    if len(OTP_HASH_SECRET) < 32:
        raise RuntimeError("OTP_HASH_SECRET must contain at least 32 characters")
    value = f"{email}:{otp}:{salt}".encode("utf-8")
    return hmac.new(OTP_HASH_SECRET.encode("utf-8"), value, hashlib.sha256).hexdigest()


def verify_email_otp(email: str, otp: str, salt: str, expected_hash: str) -> bool:
    try:
        candidate = hash_email_otp(email, otp, salt)
    except RuntimeError:
        return False
    return hmac.compare_digest(candidate, expected_hash)
