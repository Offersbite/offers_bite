import argparse
import os
import re

from google_auth_oauthlib.flow import InstalledAppFlow

from app.core.config import (
    GOOGLE_AUTH_URI,
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI,
    GOOGLE_TOKEN_URI,
    PROJECT_ROOT,
)
from app.services.email import GMAIL_SEND_SCOPE


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Authorize OffersBite to send email through Gmail and save the refresh token in .env."
    )
    parser.add_argument(
        "--env-file",
        default=str(PROJECT_ROOT / ".env"),
        help="Environment file to update (default: project-root .env).",
    )
    return parser.parse_args()


def update_env_value(env_path: str, key: str, value: str) -> None:
    with open(env_path, encoding="utf-8") as env_file:
        lines = env_file.readlines()
    assignment = f"{key}={value}\n"
    key_pattern = re.compile(rf"^\s*{re.escape(key)}\s*=")
    found = False
    updated_lines = []
    for line in lines:
        if key_pattern.match(line):
            if not found:
                updated_lines.append(assignment)
                found = True
        else:
            updated_lines.append(line)
    if not found:
        if updated_lines and not updated_lines[-1].endswith(("\n", "\r")):
            updated_lines[-1] += "\n"
        updated_lines.append(assignment)
    with open(env_path, "w", encoding="utf-8", newline="") as env_file:
        env_file.writelines(updated_lines)


def main() -> None:
    args = parse_args()
    env_path = os.path.abspath(args.env_file)
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        raise SystemExit(
            "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in the project .env first."
        )

    flow = InstalledAppFlow.from_client_config(
        {
            "web": {
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "auth_uri": GOOGLE_AUTH_URI,
                "token_uri": GOOGLE_TOKEN_URI,
                "redirect_uris": [GOOGLE_REDIRECT_URI],
            }
        },
        scopes=[GMAIL_SEND_SCOPE],
    )
    credentials = flow.run_local_server(
        host="localhost",
        port=8765,
        authorization_prompt_message=(
            "Open this URL in your browser to authorize Gmail: {url}"
        ),
        open_browser=True,
        success_message="Gmail authorization is complete. You may close this tab.",
        access_type="offline",
        prompt="consent",
    )
    if not credentials.refresh_token:
        raise SystemExit(
            "Google did not return a refresh token. Remove OffersBite access from "
            "your Google Account and run authorization again."
        )
    update_env_value(env_path, "GOOGLE_REDIRECT_URI", GOOGLE_REDIRECT_URI)
    update_env_value(env_path, "GOOGLE_REFRESH_TOKEN", credentials.refresh_token)
    print(f"Gmail authorization saved to {env_path}. Restart the backend.")


if __name__ == "__main__":
    main()
