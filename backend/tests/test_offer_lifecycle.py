import unittest
from datetime import datetime, timezone
from unittest.mock import patch
from app.services import offer_lifecycle
from app.services.catalogue_status import catalogue_status, catalogue_counts
from app.api.routes import offers


class OfferLifecycleTests(unittest.TestCase):
    def test_expiry_changes_at_india_midnight(self):
        before = datetime(2026, 10, 14, 18, 29, 59, tzinfo=timezone.utc)
        after = datetime(2026, 10, 14, 18, 30, tzinfo=timezone.utc)
        record = {"expires_on": datetime(2026, 10, 14, tzinfo=timezone.utc), "valid_days": [6], "applicable_master_card_ids": [1]}
        self.assertEqual(catalogue_status(record, "offers", before), "active")
        self.assertEqual(catalogue_status(record, "offers", after), "expired")

    def test_archiving_preserves_records_and_tracking_timestamp(self):
        now = datetime(2026, 10, 14, 18, 30, tzinfo=timezone.utc)
        with patch.object(offer_lifecycle, "merchant_offers") as collection:
            collection.update_many.return_value.modified_count = 3
            self.assertEqual(offer_lifecycle.archive_expired_offers(now), 3)
            query, update = collection.update_many.call_args.args
            self.assertEqual(query["is_archived"], {"$ne": True})
            self.assertEqual(query["expires_on"]["$lt"].day, 15)
            self.assertEqual(update["$set"]["archive_reason"], "expired")
            self.assertEqual(update["$set"]["archived_at"], now)
            collection.delete_many.assert_not_called()

    def test_counts_are_exclusive_and_sum_to_total(self):
        rows = [{"valid_days": [0], "applicable_master_card_ids": [1]},
                {"is_matchable": False},
                {"is_archived": True, "archive_reason": "expired"}]
        self.assertEqual(catalogue_counts(rows, "offers"), {"total": 3, "active": 1, "inactive": 1, "expired": 1})
        self.assertEqual(catalogue_counts([{}, {"is_active": False}], "cards"), {"total": 2, "active": 1, "inactive": 1, "expired": 0})

    def test_user_offer_endpoints_exclude_expired_and_archived(self):
        with patch.object(offers, "merchant_offers") as collection, patch.object(offers, "master_cards") as cards:
            cards.find.return_value = []
            collection.find.return_value.sort.return_value = []
            offers.get_offers({}, day=None, category=None)
            general_query = collection.find.call_args.args[0]
            self.assertEqual(general_query["is_archived"], {"$ne": True})
            self.assertIn("$gte", general_query["$or"][0]["expires_on"])
            offers.get_matched_offers({"wallet_cards": [{"master_card_id": 1}]}, day=None, all_days=True)
            matched_query = collection.find.call_args.args[0]
            self.assertEqual(matched_query["is_archived"], {"$ne": True})
            self.assertEqual(matched_query["$or"], general_query["$or"])
