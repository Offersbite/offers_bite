import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

from bson import ObjectId
from fastapi import HTTPException

from app.services import auth


class EmailVerificationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.collection_patch = patch.object(auth, "pending_registrations")
        self.pending = self.collection_patch.start()
        self.addCleanup(self.collection_patch.stop)
        self.pending.find_one.return_value = None
        self.pending.replace_one.side_effect = self.save_pending
        self.pending_document = None
        self.send_patch = patch.object(auth, "send_verification_otp")
        self.send_email = self.send_patch.start()
        self.addCleanup(self.send_patch.stop)
        self.secret_patch = patch.object(auth, "OTP_HASH_SECRET", "test-secret-" * 4)
        self.secret_patch.start()
        self.addCleanup(self.secret_patch.stop)
        self.hash_secret_patch = patch("app.core.security.OTP_HASH_SECRET", "test-secret-" * 4)
        self.hash_secret_patch.start()
        self.addCleanup(self.hash_secret_patch.stop)

    def save_pending(self, *_args, **_kwargs):
        document = _args[1]
        self.assertTrue(_kwargs["upsert"])
        document["_id"] = ObjectId()
        self.pending_document = document

    def test_otp_is_emailed_and_only_its_hash_is_stored(self) -> None:
        auth.issue_email_otp("person@example.com", "Person", "hashed-password")

        sent_otp = self.send_email.call_args.args[1]
        self.assertRegex(sent_otp, r"^\d{4}$")
        self.assertEqual(self.pending_document["email"], "person@example.com")
        self.assertNotIn("otp", self.pending_document)
        self.assertNotEqual(self.pending_document["otpHash"], sent_otp)
        self.assertEqual(self.pending_document["attemptsRemaining"], auth.OTP_MAX_ATTEMPTS)

    def test_invalid_code_decrements_remaining_attempts(self) -> None:
        self.pending.find_one.return_value = {
            "_id": ObjectId(),
            "expiresAt": datetime.now(timezone.utc) + timedelta(minutes=5),
            "otpSalt": "salt",
            "otpHash": "not-the-request-code",
            "attemptsRemaining": 5,
        }

        with self.assertRaises(HTTPException) as result:
            auth.verify_registration("person@example.com", "0000")

        self.assertEqual(result.exception.status_code, 400)
        self.pending.update_one.assert_called_once()

    def test_wrong_code_on_last_attempt_removes_challenge(self) -> None:
        challenge_id = ObjectId()
        self.pending.find_one.return_value = {
            "_id": challenge_id,
            "expiresAt": datetime.now(timezone.utc) + timedelta(minutes=5),
            "otpSalt": "salt",
            "otpHash": "not-the-request-code",
            "attemptsRemaining": 1,
        }

        with self.assertRaises(HTTPException):
            auth.verify_registration("person@example.com", "0000")

        self.pending.delete_one.assert_called_once_with({"_id": challenge_id})
        self.pending.update_one.assert_not_called()

    def test_valid_code_creates_verified_user(self) -> None:
        from app.core.security import hash_email_otp

        email = "person@example.com"
        code = "0427"
        challenge_id = ObjectId()
        self.pending.find_one.return_value = {
            "_id": challenge_id,
            "email": email,
            "name": "Person",
            "passwordHash": "hashed-password",
            "expiresAt": datetime.now(timezone.utc) + timedelta(minutes=5),
            "otpSalt": "salt",
            "otpHash": hash_email_otp(email, code, "salt"),
            "attemptsRemaining": 5,
        }
        users_mock = MagicMock()
        users_mock.insert_one.return_value.inserted_id = ObjectId()

        with patch.object(auth, "users", users_mock):
            user = auth.verify_registration(email, code)

        self.assertEqual(user["email"], email)
        self.assertIn("emailVerifiedAt", user)
        users_mock.insert_one.assert_called_once()
        self.pending.delete_one.assert_called_once_with({"_id": challenge_id})


if __name__ == "__main__":
    unittest.main()
