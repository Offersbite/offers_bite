from typing import Any

from fastapi import APIRouter
from pymongo import ASCENDING

from app.db.mongo import master_cards
from app.dependencies.auth import CurrentUser


router = APIRouter(prefix="/cards", tags=["cards"])


@router.get("/master")
def get_master_cards(_: CurrentUser) -> list[dict[str, Any]]:
    return [
        {
            "id": card["id"],
            "bank_name": card["bank_name"],
            "card_name": card["card_name"],
            "card_type": card["card_type"],
            "network": card["network"],
            "tier_category": card.get("tier_category", "STANDARD"),
        }
        for card in master_cards.find().sort("bank_name", ASCENDING)
    ]
