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
    card_ids = list({
        card["master_card_id"]
        for card in wallet_cards
        if card.get("master_card_id") is not None
    })
    catalog = {
        card["id"]: card for card in master_cards.find({"id": {"$in": card_ids}})
    }
    result = []
    for wallet_card in wallet_cards:
        master_card_id = wallet_card.get("master_card_id")
        master = catalog.get(master_card_id) if master_card_id is not None else None
        if master_card_id is not None and master is None:
            continue
        result.append({
            "id": wallet_card["id"],
            "cardholder_label": wallet_card["cardholder_label"],
            "custom_nickname": wallet_card.get("custom_nickname"),
            "bank_name": master["bank_name"] if master else wallet_card["bank_name"],
            "card_name": master["card_name"] if master else wallet_card["card_name"],
            "card_type": master["card_type"] if master else wallet_card["card_type"],
            "network": master["network"] if master else wallet_card["network"],
            "tier_category": (master if master else wallet_card).get("tier_category", "STANDARD"),
            "master_card_id": master["id"] if master else None,
            "is_custom": master is None,
        })
    return sorted(
        result, key=lambda card: (card["cardholder_label"], card["bank_name"])
    )


@router.post("", status_code=201)
def add_wallet_card(card: WalletCardCreate, user: CurrentUser) -> dict[str, Any]:
    master = None
    if card.masterCardId is not None:
        master = master_cards.find_one({"id": card.masterCardId})
        if not master:
            raise HTTPException(status_code=404, detail="Card not found")

    nickname = card.customNickname.strip() if card.customNickname else ""
    wallet_card = {
        "id": str(uuid4()),
        "cardholder_label": card.cardholderLabel,
        "custom_nickname": nickname or None,
        "created_at": datetime.now(timezone.utc),
        "is_active": True,
    }
    if master:
        wallet_card["master_card_id"] = card.masterCardId
        duplicate_match = {
            "master_card_id": card.masterCardId,
            "cardholder_label": card.cardholderLabel,
            "is_active": True,
        }
        card_details = {
            "bank_name": master["bank_name"],
            "card_name": master["card_name"],
            "card_type": master["card_type"],
            "network": master["network"],
        }
    else:
        card_details = {
            "bank_name": card.bankName,
            "card_name": card.cardName,
            "card_type": card.cardType,
            "network": card.network,
        }
        wallet_card.update(card_details)
        wallet_card["tier_category"] = card.tierCategory
        duplicate_match = {
            **card_details,
            "cardholder_label": card.cardholderLabel,
            "is_active": True,
        }
    updated_user = users.find_one_and_update(
        {
            "_id": user["_id"],
            "wallet_cards": {"$not": {"$elemMatch": duplicate_match}},
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
        if any(
            all(existing.get(key) == value for key, value in duplicate_match.items())
            for existing in current_cards
        ):
            return {"message": "Already exists"}
        if len(current_cards) >= MAX_WALLET_CARDS:
            raise HTTPException(
                status_code=409,
                detail=f"A wallet can contain at most {MAX_WALLET_CARDS} cards.",
            )
        raise HTTPException(
            status_code=409,
            detail="The card could not be added because the wallet changed. Please retry.",
        )
    return {
        **wallet_card,
        **card_details,
        "master_card_id": card.masterCardId,
        "is_custom": master is None,
    }


@router.patch("/{card_id}")
def update_wallet_card(
    card_id: str, card: WalletCardCreate, user: CurrentUser,
) -> dict[str, Any]:
    existing = next((item for item in user.get("wallet_cards", []) if item["id"] == card_id), None)
    if existing is None:
        raise HTTPException(status_code=404, detail="Wallet card not found")
    master = None
    if card.masterCardId is not None:
        master = master_cards.find_one({"id": card.masterCardId})
        if master is None:
            raise HTTPException(status_code=404, detail="Card not found")
    replacement = {
        "id": card_id,
        "cardholder_label": card.cardholderLabel,
        "custom_nickname": card.customNickname or None,
        "created_at": existing.get("created_at", datetime.now(timezone.utc)),
        "updated_at": datetime.now(timezone.utc),
        "is_active": existing.get("is_active", True),
    }
    duplicate_match = {"id": {"$ne": card_id}, "cardholder_label": card.cardholderLabel, "is_active": True}
    if master is not None:
        replacement["master_card_id"] = card.masterCardId
        duplicate_match["master_card_id"] = card.masterCardId
    else:
        details = {"bank_name": card.bankName, "card_name": card.cardName,
                   "card_type": card.cardType, "network": card.network}
        replacement.update(details)
        replacement["tier_category"] = card.tierCategory
        duplicate_match.update(details)
    updated = users.find_one_and_update(
        {"_id": user["_id"], "wallet_cards.id": card_id,
         "wallet_cards": {"$not": {"$elemMatch": duplicate_match}}},
        {"$set": {"wallet_cards.$[card]": replacement}},
        array_filters=[{"card.id": card_id}],
        return_document=ReturnDocument.AFTER,
    )
    if updated is None:
        raise HTTPException(status_code=409, detail="This card already exists for the selected holder, or your wallet changed. Refresh and try again.")
    details = master if master is not None else replacement
    return {**replacement, "bank_name": details["bank_name"], "card_name": details["card_name"],
            "card_type": details["card_type"], "network": details["network"],
            "tier_category": details.get("tier_category", "STANDARD"),
            "master_card_id": card.masterCardId, "is_custom": master is None}


@router.delete("/{card_id}")
def delete_wallet_card(card_id: str, user: CurrentUser) -> dict[str, bool]:
    users.update_one(
        {"_id": user["_id"]},
        {"$pull": {"wallet_cards": {"id": card_id}}},
    )
    return {"success": True}
