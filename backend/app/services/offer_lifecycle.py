from datetime import datetime, timedelta, timezone
from app.db.mongo import merchant_offers

INDIA_TIMEZONE = timezone(timedelta(hours=5, minutes=30))


def offer_date_cutoff(now: datetime | None = None) -> datetime:
    now = now or datetime.now(timezone.utc)
    return datetime.combine(now.astimezone(INDIA_TIMEZONE).date(), datetime.min.time(), tzinfo=timezone.utc)


def archive_expired_offers(now: datetime | None = None) -> int:
    now = now or datetime.now(timezone.utc)
    result = merchant_offers.update_many(
        {"expires_on": {"$lt": offer_date_cutoff(now)}, "is_archived": {"$ne": True}},
        {"$set": {"is_archived": True, "archived_at": now, "archive_reason": "expired"}},
    )
    return result.modified_count
