from typing import Any

from pymongo import DESCENDING, ReturnDocument

from app.db.mongo import counters


def new_catalogue_id(counter_name: str, collection: Any) -> int:
    latest = collection.find_one({}, {"id": 1}, sort=[("id", DESCENDING)])
    highest_id = latest["id"] if latest else 0
    counters.update_one(
        {"_id": counter_name},
        {"$max": {"value": highest_id}},
        upsert=True,
    )
    counter = counters.find_one_and_update(
        {"_id": counter_name},
        {"$inc": {"value": 1}},
        return_document=ReturnDocument.AFTER,
    )
    return int(counter["value"])
