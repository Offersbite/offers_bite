import base64
import logging
import threading
from email.message import EmailMessage

from google.auth.exceptions import GoogleAuthError
from google.auth.transport.requests import Request as GoogleAuthRequest
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from app.core.config import (
    GMAIL_FROM_EMAIL,
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REFRESH_TOKEN,
    GOOGLE_TOKEN_URI,
)


logger = logging.getLogger(__name__)
GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send"
_credentials_lock = threading.Lock()
_cached_credentials: Credentials | None = None


class EmailDeliveryError(RuntimeError):
    pass


def _load_gmail_credentials() -> Credentials:
    global _cached_credentials
    with _credentials_lock:
        credentials = _cached_credentials
        if credentials is None:
            if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET or not GOOGLE_REFRESH_TOKEN:
                raise EmailDeliveryError(
                    "Gmail API is not authorized. Configure Google OAuth credentials and "
                    "run `python -m scripts.authorize_gmail` from the backend folder."
                )
            credentials = Credentials(
                token=None,
                refresh_token=GOOGLE_REFRESH_TOKEN,
                token_uri=GOOGLE_TOKEN_URI,
                client_id=GOOGLE_CLIENT_ID,
                client_secret=GOOGLE_CLIENT_SECRET,
                scopes=[GMAIL_SEND_SCOPE],
            )
            _cached_credentials = credentials

        if credentials.expired or not credentials.token:
            credentials.refresh(GoogleAuthRequest())
        return credentials


def send_verification_otp(email: str, otp: str) -> None:
    if not GMAIL_FROM_EMAIL:
        raise EmailDeliveryError("Set GMAIL_FROM_EMAIL to the authorized Gmail address.")

    message = EmailMessage()
    message["Subject"] = "Your OffersBite verification code"
    message["From"] = GMAIL_FROM_EMAIL
    message["To"] = email
    message.set_content(
        f"Your OffersBite email verification code is {otp}.\n\n"
        "This code expires in 10 minutes. If you did not request it, you can "
        "ignore this email."
    )
    raw_message = base64.urlsafe_b64encode(message.as_bytes()).decode("ascii")

    try:
        gmail = build(
            "gmail",
            "v1",
            credentials=_load_gmail_credentials(),
            cache_discovery=False,
        )
        gmail.users().messages().send(userId="me", body={"raw": raw_message}).execute()
    except (GoogleAuthError, HttpError, OSError, ValueError) as exc:
        logger.error(
            "Gmail API verification email delivery failed (%s)",
            type(exc).__name__,
            exc_info=(type(exc), exc, exc.__traceback__),
        )
        raise EmailDeliveryError(
            "Gmail could not send the verification email. Check the OAuth "
            "authorization and sender configuration."
        ) from exc
