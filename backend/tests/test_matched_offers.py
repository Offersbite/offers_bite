import unittest
from unittest.mock import patch

from app.api.routes import offers


class MatchedOfferDayTests(unittest.TestCase):
    def test_all_days_includes_weekend_without_day_filter(self):
        self.check_day_filter(True, None)

    def test_selected_day_retains_day_filter(self):
        self.check_day_filter(False, 6)

    def check_day_filter(self, all_days, expected_day):
        user = {"wallet_cards": [{"master_card_id": 1, "cardholder_label": "Self"}]}
        weekend_offer = {"id": 5, "merchant_name": "Cinema", "category": "MOVIES",
                         "offer_headline": "Weekend savings", "valid_days": [6, 0],
                         "applicable_master_card_ids": [1]}
        with patch.object(offers, "merchant_offers") as merchants, patch.object(offers, "master_cards") as cards:
            merchants.find.return_value.sort.return_value = [weekend_offer]
            cards.find.return_value = [{"id": 1, "bank_name": "PNB", "card_name": "Platinum"}]
            result = offers.get_matched_offers(user, day=6, all_days=all_days)
            query = merchants.find.call_args.args[0]
            if expected_day is None:
                self.assertNotIn("valid_days", query)
            else:
                self.assertEqual(query["valid_days"], expected_day)
            self.assertEqual(result[0]["valid_days"], [6, 0])
            self.assertIn("expires_on", query["$or"][0])
