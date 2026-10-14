from app.services.offer_lifecycle import offer_date_cutoff
from datetime import datetime, timezone
from typing import Any


def catalogue_status(record: dict[str, Any], kind: str, now: datetime | None = None) -> str:
    if kind == "cards":
        return "inactive" if record.get("is_active", True) is False else "active"
    now = now or datetime.now(timezone.utc)
    expiry = record.get("expires_on")
    if expiry is not None:
        if expiry.tzinfo is None:
            expiry = expiry.replace(tzinfo=timezone.utc)
        # Offer expiry dates stay valid for the full date, as in offer matching.
        if expiry < offer_date_cutoff(now):
            return "expired"
    if record.get("is_archived") and record.get("archive_reason") == "expired":
        return "expired"
    if (record.get("is_archived", False) or record.get("is_active", True) is False or record.get("is_matchable", True) is False
            or not record.get("valid_days") or not record.get("applicable_master_card_ids")):
        return "inactive"
    return "active"


def catalogue_counts(records: list[dict[str, Any]], kind: str) -> dict[str, int]:
    counts = {"total": len(records), "active": 0, "inactive": 0, "expired": 0}
    now = datetime.now(timezone.utc)
    for record in records:
        counts[catalogue_status(record, kind, now)] += 1
    return counts
