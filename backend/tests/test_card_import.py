import unittest
from io import BytesIO
from openpyxl import Workbook

from app.services.card_import import parse_card_csv, parse_card_workbook, CardImportError


class CardImportTests(unittest.TestCase):
    def test_parse_csv_with_user_column_order(self) -> None:
        csv_data = (
            "Bank Name,Card_Type,Network,Tier_Category,Card_Name\n"
            "HDFC Bank,CREDIT,VISA,REGALIA,Regalia Gold\n"
            "ICICI Bank,DEBIT,RUPAY,CORAL,Coral Debit Card\n"
        ).encode("utf-8")

        cards = parse_card_csv(csv_data)
        self.assertEqual(len(cards), 2)
        self.assertEqual(cards[0]["bank_name"], "HDFC Bank")
        self.assertEqual(cards[0]["card_type"], "CREDIT")
        self.assertEqual(cards[0]["network"], "VISA")
        self.assertEqual(cards[0]["tier_category"], "REGALIA")
        self.assertEqual(cards[0]["card_name"], "Regalia Gold")

        self.assertEqual(cards[1]["bank_name"], "ICICI Bank")
        self.assertEqual(cards[1]["card_type"], "DEBIT")
        self.assertEqual(cards[1]["network"], "RUPAY")
        self.assertEqual(cards[1]["tier_category"], "CORAL")
        self.assertEqual(cards[1]["card_name"], "Coral Debit Card")

    def test_parse_csv_with_default_tier(self) -> None:
        csv_data = (
            "Bank Name,Card Name,Card Type,Network\n"
            "Axis Bank,Neo Card,CREDIT,MASTERCARD\n"
        ).encode("utf-8")

        cards = parse_card_csv(csv_data)
        self.assertEqual(len(cards), 1)
        self.assertEqual(cards[0]["tier_category"], "STANDARD")

    def test_parse_workbook_with_user_column_order(self) -> None:
        wb = Workbook()
        ws = wb.active
        ws.title = "Master Cards"
        ws.append(["Bank Name", "Card_Type", "Network", "Tier_Category", "Card_Name"])
        ws.append(["SBI Card", "CREDIT", "VISA", "PLATINUM", "SimplySAVE"])
        stream = BytesIO()
        wb.save(stream)
        wb.close()

        cards = parse_card_workbook(stream.getvalue())
        self.assertEqual(len(cards), 1)
        self.assertEqual(cards[0]["bank_name"], "SBI Card")
        self.assertEqual(cards[0]["card_type"], "CREDIT")
        self.assertEqual(cards[0]["network"], "VISA")
        self.assertEqual(cards[0]["tier_category"], "PLATINUM")
        self.assertEqual(cards[0]["card_name"], "SimplySAVE")

    def test_missing_required_column_raises_error(self) -> None:
        csv_data = "Bank Name,Network\nHDFC,VISA\n".encode("utf-8")
        with self.assertRaises(CardImportError):
            parse_card_csv(csv_data)


if __name__ == "__main__":
    unittest.main()

