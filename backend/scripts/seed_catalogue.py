import json
from typing import Any

from bson import json_util

from app.core.config import PROJECT_ROOT
from app.db.indexes import ensure_indexes
from app.db.mongo import close_database, connect_database, master_cards, merchant_offers


def load_catalogue() -> dict[str, list[dict[str, Any]]]:
    source = PROJECT_ROOT / "backend" / "data" / "catalogue.json"
    return json.loads(source.read_text(encoding="utf-8"), object_hook=json_util.object_hook)


def seed_collection(collection: Any, records: list[dict[str, Any]]) -> None:
    for record in records:
        collection.update_one(
            {"id": record["id"]},
            {"$setOnInsert": record},
            upsert=True,
        )


def main() -> None:
    try:
        connect_database()
        ensure_indexes()
        catalogue = load_catalogue()
        seed_collection(master_cards, catalogue["master_cards"])
        seed_collection(merchant_offers, catalogue["merchant_offers"])
        print(
            "Catalogue seeded:",
            f"{len(catalogue['master_cards'])} cards and "
            f"{len(catalogue['merchant_offers'])} offers (existing IDs unchanged).",
        )
    finally:
        close_database()


if __name__ == "__main__":
    main()
