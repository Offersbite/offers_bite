from pymongo import MongoClient

from app.core.config import MONGODB_DATABASE, MONGODB_URI


client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=5000, tz_aware=True)
database = client[MONGODB_DATABASE]

users = database["users"]
sessions = database["sessions"]
pending_registrations = database["pending_registrations"]
master_cards = database["master_cards"]
merchant_offers = database["merchant_offers"]
counters = database["counters"]


def connect_database() -> None:
    client.admin.command("ping")


def close_database() -> None:
    client.close()
