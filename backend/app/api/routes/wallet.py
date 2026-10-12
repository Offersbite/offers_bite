from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, HTTPException
from pymongo import ReturnDocument

from app.db.mongo import master_cards, users
from app.dependencies.auth import CurrentUser
from app.schemas.wallet import WalletCardCreate


router = APIRouter(prefix="/wallet", tags=["wallet"])
MAX_WALLET_CARDS = 50


@router.get("")
def get_wallet(user: CurrentUser) -> list[dict[str, Any]]:
    wallet_cards = user.get("wallet_cards", [])
    card_ids = list({card["master_card_id"] for card in wallet_cards})
    catalog = {
        card["id"]: card for card in master_cards.find({"id": {"$in": card_ids}})
    }
    result = []
    for wallet_card in wallet_cards:
        master = catalog.get(wallet_card["master_card_id"])
        if master:
            result.append(
                {
                    "id": wallet_card["id"],
                    "cardholder_label": wallet_card["cardholder_label"],
                    "custom_nickname": wallet_card.get("custom_nickname"),
                    "bank_name": master["bank_name"],
                    "card_name": master["card_name"],
                    "card_type": master["card_type"],
                    "network": master["network"],
                    "master_card_id": master["id"],
                }
            )
    return sorted(
        result, key=lambda card: (card["cardholder_label"], card["bank_name"])
    )


@router.post("", status_code=201)
def add_wallet_card(card: WalletCardCreate, user: CurrentUser) -> dict[str, Any]:
    master = master_cards.find_one({"id": card.masterCardId})
    if not master:
        raise HTTPException(status_code=404, detail="Card not found")

    nickname = card.customNickname.strip() if card.customNickname else ""
    wallet_card = {
        "id": str(uuid4()),
        "master_card_id": card.masterCardId,
        "cardholder_label": card.cardholderLabel,
        "custom_nickname": nickname or None,
        "created_at": datetime.now(timezone.utc),
        "is_active": True,
    }
    updated_user = users.find_one_and_update(
        {
            "_id": user["_id"],
            "wallet_cards": {
                "$not": {
                    "$elemMatch": {
                        "master_card_id": card.masterCardId,
                        "cardholder_label": card.cardholderLabel,
                        "is_active": True,
                    }
                }
            },
            "$expr": {
                "$lt": [
                    {"$size": {"$ifNull": ["$wallet_cards", []]}},
                    MAX_WALLET_CARDS,
                ]
            },
        },
        {"$push": {"wallet_cards": wallet_card}},
        return_document=ReturnDocument.AFTER,
    )
    if not updated_user:
        current_user = users.find_one({"_id": user["_id"]}, {"wallet_cards": 1})
        if current_user is None:
            raise HTTPException(status_code=404, detail="Account not found")
        current_cards = current_user.get("wallet_cards", [])
        if len(current_cards) >= MAX_WALLET_CARDS:
            raise HTTPException(
                status_code=409,
                detail=f"A wallet can contain at most {MAX_WALLET_CARDS} cards.",
            )
        return {"message": "Already exists"}
    return {
        **wallet_card,
        "bank_name": master["bank_name"],
        "card_name": master["card_name"],
        "card_type": master["card_type"],
        "network": master["network"],
    }


@router.delete("/{card_id}")
def delete_wallet_card(card_id: str, user: CurrentUser) -> dict[str, bool]:
    users.update_one(
        {"_id": user["_id"]},
        {"$pull": {"wallet_cards": {"id": card_id}}},
    )
    return {"success": True}
