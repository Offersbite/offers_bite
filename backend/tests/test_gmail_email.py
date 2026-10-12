import base64
import tempfile
import unittest
from email import message_from_bytes
from pathlib import Path
from urllib.parse import parse_qs, urlparse
from unittest.mock import ANY, MagicMock, patch

from google_auth_oauthlib.flow import InstalledAppFlow

from app.core.config import GOOGLE_REDIRECT_URI
from scripts.authorize_gmail import update_env_value
from app.services import email


class GmailEmailTests(unittest.TestCase):
    def test_sends_otp_using_gmail_api(self) -> None:
        gmail = MagicMock()
        build_patch = patch.object(email, "build", return_value=gmail)
        build_mock = build_patch.start()
        self.addCleanup(build_patch.stop)
        credentials_patch = patch.object(
            email, "_load_gmail_credentials", return_value=object()
        )
        credentials_patch.start()
        self.addCleanup(credentials_patch.stop)
        sender_patch = patch.object(email, "GMAIL_FROM_EMAIL", "sender@gmail.com")
        sender_patch.start()
        self.addCleanup(sender_patch.stop)

        email.send_verification_otp("person@example.com", "0427")

        build_mock.assert_called_once_with(
            "gmail",
            "v1",
            credentials=ANY,
            cache_discovery=False,
        )
        send_args = gmail.users.return_value.messages.return_value.send.call_args.kwargs
        self.assertEqual(send_args["userId"], "me")
        raw = base64.urlsafe_b64decode(send_args["body"]["raw"])
        message = message_from_bytes(raw)
        self.assertEqual(message["To"], "person@example.com")
        self.assertIn("0427", message.get_payload(decode=True).decode())

    def test_missing_sender_is_reported_without_calling_google(self) -> None:
        sender_patch = patch.object(email, "GMAIL_FROM_EMAIL", "")
        sender_patch.start()
        self.addCleanup(sender_patch.stop)
        build_patch = patch.object(email, "build")
        build_mock = build_patch.start()
        self.addCleanup(build_patch.stop)

        with self.assertRaises(email.EmailDeliveryError):
            email.send_verification_otp("person@example.com", "0427")

        build_mock.assert_not_called()

    def test_missing_authorization_produces_setup_guidance(self) -> None:
        credentials_patch = patch.object(
            email, "_load_gmail_credentials", side_effect=email.EmailDeliveryError("Authorize Gmail")
        )
        credentials_patch.start()
        self.addCleanup(credentials_patch.stop)
        sender_patch = patch.object(email, "GMAIL_FROM_EMAIL", "sender@gmail.com")
        sender_patch.start()
        self.addCleanup(sender_patch.stop)

        with self.assertRaises(email.EmailDeliveryError):
            email.send_verification_otp("person@example.com", "0427")

    def test_authorization_flow_accepts_google_web_client_configuration(self) -> None:
        flow = InstalledAppFlow.from_client_config(
            {
                "web": {
                    "client_id": "client-id",
                    "client_secret": "client-secret",
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "redirect_uris": [GOOGLE_REDIRECT_URI],
                }
            },
            scopes=[email.GMAIL_SEND_SCOPE],
        )
        self.assertEqual(flow.client_type, "web")
        authorization_url, _ = flow.authorization_url()
        scopes = parse_qs(urlparse(authorization_url).query)["scope"][0]
        self.assertEqual(scopes, email.GMAIL_SEND_SCOPE)

    def test_refresh_token_updates_env_without_dropping_other_settings(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            env_path = Path(directory) / ".env"
            env_path.write_text(
                "MONGODB_DATABASE=cardperks\nGOOGLE_REFRESH_TOKEN=old-token\n",
                encoding="utf-8",
            )

            update_env_value(str(env_path), "GOOGLE_REFRESH_TOKEN", "new-token")

            contents = env_path.read_text(encoding="utf-8")
            self.assertIn("MONGODB_DATABASE=cardperks", contents)
            self.assertEqual(contents.count("GOOGLE_REFRESH_TOKEN="), 1)
            self.assertIn("GOOGLE_REFRESH_TOKEN=new-token", contents)


if __name__ == "__main__":
    unittest.main()
