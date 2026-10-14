import unittest
from unittest.mock import patch
from fastapi import HTTPException
from app.api.routes import wallet
from app.schemas.wallet import WalletCardCreate


class WalletEditTests(unittest.TestCase):
    def setUp(self):
        self.user = {"_id": "owner", "wallet_cards": [{"id": "wallet-1", "master_card_id": 1, "cardholder_label": "Self", "created_at": "original", "is_active": True}]}

    def test_catalogue_edit_keeps_identity_and_scopes_write_to_owner(self):
        with patch.object(wallet, "master_cards") as catalogue, patch.object(wallet, "users") as users:
            catalogue.find_one.return_value = {"id": 2, "bank_name": "Bank", "card_name": "Rewards", "card_type": "CREDIT", "network": "VISA"}
            users.find_one_and_update.return_value = self.user
            result = wallet.update_wallet_card("wallet-1", WalletCardCreate(masterCardId=2, cardholderLabel="Spouse", customNickname=" Dining "), self.user)
            query, update = users.find_one_and_update.call_args.args
            self.assertEqual(query["_id"], "owner")
            self.assertEqual(query["wallet_cards.id"], "wallet-1")
            self.assertEqual(query["wallet_cards"]["$not"]["$elemMatch"]["id"], {"$ne": "wallet-1"})
            stored = update["$set"]["wallet_cards.$[card]"]
            self.assertEqual(stored["id"], "wallet-1")
            self.assertEqual(stored["created_at"], "original")
            self.assertEqual(stored["master_card_id"], 2)
            self.assertEqual(stored["custom_nickname"], "Dining")
            self.assertEqual(result["cardholder_label"], "Spouse")

    def test_cannot_edit_another_users_card(self):
        with patch.object(wallet, "users") as users:
            with self.assertRaises(HTTPException) as error:
                wallet.update_wallet_card("someone-elses-card", WalletCardCreate(masterCardId=1), self.user)
            self.assertEqual(error.exception.status_code, 404)
            users.find_one_and_update.assert_not_called()

    def test_duplicate_conflict_is_reported(self):
        with patch.object(wallet, "master_cards") as catalogue, patch.object(wallet, "users") as users:
            catalogue.find_one.return_value = {"id": 1}
            users.find_one_and_update.return_value = None
            with self.assertRaises(HTTPException) as error:
                wallet.update_wallet_card("wallet-1", WalletCardCreate(masterCardId=1), self.user)
            self.assertEqual(error.exception.status_code, 409)

    def test_custom_edit_removes_catalogue_reference_and_preserves_tier(self):
        with patch.object(wallet, "users") as users:
            users.find_one_and_update.return_value = self.user
            result = wallet.update_wallet_card("wallet-1", WalletCardCreate(bankName="Custom Bank", cardName="Custom Card", cardType="DEBIT", network="RUPAY", tierCategory="GOLD", customNickname=""), self.user)
            stored = users.find_one_and_update.call_args.args[1]["$set"]["wallet_cards.$[card]"]
            self.assertNotIn("master_card_id", stored)
            self.assertEqual(stored["tier_category"], "GOLD")
            self.assertIsNone(stored["custom_nickname"])
            self.assertTrue(result["is_custom"])

    def test_missing_catalogue_card_does_not_write(self):
        with patch.object(wallet, "master_cards") as catalogue, patch.object(wallet, "users") as users:
            catalogue.find_one.return_value = None
            with self.assertRaises(HTTPException) as error:
                wallet.update_wallet_card("wallet-1", WalletCardCreate(masterCardId=9), self.user)
            self.assertEqual(error.exception.status_code, 404)
            users.find_one_and_update.assert_not_called()
