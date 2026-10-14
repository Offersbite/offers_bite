from pymongo import ASCENDING

from app.db.mongo import (
    master_cards,
    merchant_offers,
    pending_registrations,
    sessions,
    users,
)


def ensure_indexes() -> None:
    users.create_index([("email", ASCENDING)], unique=True, name="users_email_unique")
    sessions.create_index(
        [("tokenHash", ASCENDING)], unique=True, name="sessions_token_hash_unique"
    )
    sessions.create_index(
        [("expiresAt", ASCENDING)], expireAfterSeconds=0, name="sessions_expiry_ttl"
    )
    sessions.create_index([("userId", ASCENDING)], name="sessions_user_id")
    pending_registrations.create_index(
        [("email", ASCENDING)], unique=True, name="pending_email_unique"
    )
    pending_registrations.create_index(
        [("expiresAt", ASCENDING)],
        expireAfterSeconds=0,
        name="pending_registrations_expiry_ttl",
    )
    master_cards.create_index(
        [("id", ASCENDING)], unique=True, name="master_cards_id_unique"
    )
    master_cards.create_index(
        [("bank_name", ASCENDING)], name="master_cards_bank_name"
    )
    merchant_offers.create_index(
        [("id", ASCENDING)], unique=True, name="offers_id_unique"
    )
    merchant_offers.create_index(
        [
            ("applicable_master_card_ids", ASCENDING),
            ("expires_on", ASCENDING),
        ],
        name="offers_match_lookup",
    )
    merchant_offers.create_index(
        [("valid_days", ASCENDING)], name="offers_valid_days"
    )
    merchant_offers.create_index(
        [
            ("source_hash", ASCENDING),
            ("source_sheet", ASCENDING),
            ("source_row", ASCENDING),
        ],
        unique=True,
        name="offers_source_row_unique",
        partialFilterExpression={"source_hash": {"$type": "string"}},
    )

    merchant_offers.create_index(
        [("is_archived", ASCENDING), ("expires_on", ASCENDING)],
        name="offers_expiry_archive",
    )
