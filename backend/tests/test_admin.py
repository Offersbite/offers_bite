import unittest
from unittest.mock import MagicMock, patch

from bson import ObjectId
from fastapi import HTTPException

from app.api.routes import admin
from app.dependencies.auth import get_admin_user
from app.schemas.admin import AdminUserUpdate


class AdminAccessTests(unittest.TestCase):
    def test_non_admin_user_is_rejected(self) -> None:
        with self.assertRaises(HTTPException) as result:
            get_admin_user({"role": "user"})

        self.assertEqual(result.exception.status_code, 403)

    def test_admin_user_is_allowed(self) -> None:
        user = {"role": "admin"}

        self.assertIs(get_admin_user(user), user)


class AdminUserManagementTests(unittest.TestCase):
    def setUp(self) -> None:
        self.users_patch = patch.object(admin, "users")
        self.users = self.users_patch.start()
        self.addCleanup(self.users_patch.stop)
        self.sessions_patch = patch.object(admin, "sessions")
        self.sessions = self.sessions_patch.start()
        self.addCleanup(self.sessions_patch.stop)
        self.admin_user = {"_id": ObjectId(), "role": "admin"}
        self.target_id = ObjectId()
        self.target_user = {
            "_id": self.target_id,
            "name": "Member",
            "email": "member@example.com",
            "role": "user",
            "isActive": True,
            "emailVerifiedAt": "verified",
            "createdAt": None,
            "wallet_cards": [],
        }

    def test_user_list_searches_and_filters_before_pagination(self) -> None:
        query = {
            "role": "user",
            "isActive": {"$ne": False},
            "$and": [{"$or": [
                {"name": {"$regex": "member\\.example", "$options": "i"}},
                {"email": {"$regex": "member\\.example", "$options": "i"}},
            ]}],
        }
        self.users.count_documents.return_value = 0
        self.users.find.return_value.sort.return_value.skip.return_value.limit.return_value = []

        result = admin.get_admin_users(
            self.admin_user,
            search="member.example",
            role="user",
            status="active",
            limit=50,
            offset=0,
        )

        self.assertEqual(result, {"items": [], "total": 0, "counts": {"total": 0, "active": 0, "inactive": 0}})
        self.users.count_documents.assert_any_call(query)
        self.users.find.assert_called_once_with(query)

    def test_user_counts_are_independent_of_search_and_pagination(self) -> None:
        self.users.count_documents.side_effect = [1, 12, 9]
        self.users.find.return_value.sort.return_value.skip.return_value.limit.return_value = []
        result = admin.get_admin_users(self.admin_user, search="member", role="user", status="active", limit=50, offset=50)
        self.assertEqual(result["total"], 1)
        self.assertEqual(result["counts"], {"total": 12, "active": 9, "inactive": 3})

    def test_cannot_demote_last_active_admin(self) -> None:
        self.users.find_one.return_value = {
            **self.target_user,
            "role": "admin",
        }
        self.users.count_documents.return_value = 1

        with self.assertRaises(HTTPException) as result:
            admin.update_admin_user(
                str(self.target_id),
                AdminUserUpdate(role="user"),
                self.admin_user,
            )

        self.assertEqual(result.exception.status_code, 409)
        self.users.update_one.assert_not_called()

    def test_cannot_grant_admin_to_unverified_account(self) -> None:
        self.users.find_one.return_value = {**self.target_user, "emailVerifiedAt": None}

        with self.assertRaises(HTTPException) as result:
            admin.update_admin_user(
                str(self.target_id),
                AdminUserUpdate(role="admin"),
                self.admin_user,
            )

        self.assertEqual(result.exception.status_code, 409)
        self.users.update_one.assert_not_called()

    def test_deactivation_revokes_existing_sessions(self) -> None:
        self.users.find_one.side_effect = [
            self.target_user,
            {**self.target_user, "isActive": False},
        ]

        record = admin.update_admin_user(
            str(self.target_id),
            AdminUserUpdate(is_active=False),
            self.admin_user,
        )

        self.assertFalse(record["is_active"])
        self.users.update_one.assert_called_once()
        self.sessions.delete_many.assert_called_once_with({"userId": self.target_id})

    def test_cannot_change_own_admin_access(self) -> None:
        self.users.find_one.return_value = self.admin_user

        with self.assertRaises(HTTPException) as result:
            admin.update_admin_user(
                str(self.admin_user["_id"]),
                AdminUserUpdate(role="user"),
                self.admin_user,
            )

        self.assertEqual(result.exception.status_code, 409)
        self.users.update_one.assert_not_called()

    def test_admin_can_update_an_account_name(self) -> None:
        self.users.find_one.side_effect = [
            self.target_user,
            {**self.target_user, "name": "Updated member"},
        ]

        record = admin.update_admin_user(
            str(self.target_id),
            AdminUserUpdate(name="Updated member"),
            self.admin_user,
        )

        self.assertEqual(record["name"], "Updated member")
        self.users.update_one.assert_called_once()

    def test_cannot_delete_own_admin_account(self) -> None:
        self.users.find_one.return_value = self.admin_user

        with self.assertRaises(HTTPException) as result:
            admin.delete_admin_user(str(self.admin_user["_id"]), self.admin_user)

        self.assertEqual(result.exception.status_code, 409)
        self.users.delete_one.assert_not_called()

    def test_cannot_delete_last_active_admin(self) -> None:
        self.users.find_one.return_value = {
            "_id": self.target_id,
            "email": "admin@example.com",
            "role": "admin",
            "isActive": True,
        }
        self.users.count_documents.return_value = 1

        with self.assertRaises(HTTPException) as result:
            admin.delete_admin_user(str(self.target_id), self.admin_user)

        self.assertEqual(result.exception.status_code, 409)
        self.users.delete_one.assert_not_called()


class AdminCatalogueTests(unittest.TestCase):
    def test_cannot_delete_card_referenced_by_wallet_or_offer(self) -> None:
        users = MagicMock()
        users.find_one.return_value = {"_id": ObjectId()}

        with (
            patch.object(admin, "users", users),
            patch.object(admin, "merchant_offers") as offers,
        ):
            with self.assertRaises(HTTPException) as result:
                admin.delete_admin_card(17, {"role": "admin"})

        self.assertEqual(result.exception.status_code, 409)
        offers.delete_one.assert_not_called()


if __name__ == "__main__":
    unittest.main()
