import os
from pathlib import Path

from dotenv import load_dotenv


PROJECT_ROOT = Path(__file__).resolve().parents[3]
load_dotenv(PROJECT_ROOT / ".env")

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
MONGODB_DATABASE = os.getenv("MONGODB_DATABASE", "cardperks")
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "false").lower() == "true"
COOKIE_NAME = "cardperks_session"
SESSION_DURATION_SECONDS = 30 * 24 * 60 * 60
OTP_EXPIRY_SECONDS = 10 * 60
OTP_RESEND_INTERVAL_SECONDS = 60
OTP_MAX_ATTEMPTS = 5
OTP_HASH_SECRET = os.getenv("OTP_HASH_SECRET", "")

GMAIL_FROM_EMAIL = os.getenv("GMAIL_FROM_EMAIL", "")
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
GOOGLE_REFRESH_TOKEN = os.getenv("GOOGLE_REFRESH_TOKEN", "")
GOOGLE_TOKEN_URI = os.getenv(
    "GOOGLE_TOKEN_URI", "https://oauth2.googleapis.com/token"
)
GOOGLE_AUTH_URI = os.getenv(
    "GOOGLE_AUTH_URI", "https://accounts.google.com/o/oauth2/auth"
)
GOOGLE_REDIRECT_URI = os.getenv(
    "GOOGLE_REDIRECT_URI", "http://localhost:8765/"
)
