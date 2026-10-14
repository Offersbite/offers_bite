from app.services.offer_lifecycle import offer_date_cutoff
from datetime import date
from typing import Any

from fastapi import APIRouter, Query
from pymongo import ASCENDING

from app.db.mongo import master_cards, merchant_offers
from app.dependencies.auth import CurrentUser


router = APIRouter(prefix="/offers", tags=["offers"])


def _format_offer_matches(
    offers: list[dict[str, Any]],
    wallet_by_master_id: dict[int, list[dict[str, Any]]],
) -> list[dict[str, Any]]:
    matching_card_ids = {
        card_id
        for offer in offers
        for card_id in offer.get("applicable_master_card_ids", [])
        if card_id in wallet_by_master_id
    }
    catalogue = {
        card["id"]: card
        for card in master_cards.find({"id": {"$in": list(matching_card_ids)}})
    }
    matches = []
    for offer in offers:
        for card_id in offer.get("applicable_master_card_ids", []):
            master = catalogue.get(card_id)
            if not master:
                continue
            for wallet_card in wallet_by_master_id.get(card_id, []):
                matches.append(
                    {
                        "offer_id": offer["id"],
                        "merchant_name": offer["merchant_name"],
                        "category": offer["category"],
                        "offer_headline": offer["offer_headline"],
                        "coupon_code": offer.get("coupon_code"),
                        "min_spend": offer.get("min_spend"),
                        "max_discount": offer.get("max_discount"),
                        "valid_days": offer["valid_days"],
                        "expires_on": offer.get("expires_on"),
                        "bank_name": master["bank_name"],
                        "card_name": master["card_name"],
                        "cardholder_label": wallet_card["cardholder_label"],
                        "custom_nickname": wallet_card.get("custom_nickname"),
                    }
                )
    return matches


@router.get("/matched")
def get_matched_offers(
    user: CurrentUser,
    day: int | None = Query(default=None, ge=0, le=6),
    all_days: bool = Query(default=False),
) -> list[dict[str, Any]]:
    target_day = day if day is not None else (date.today().weekday() + 1) % 7
    wallet_by_master_id: dict[int, list[dict[str, Any]]] = {}
    for card in user.get("wallet_cards", []):
        if card.get("is_active", True):
            master_card_id = card.get("master_card_id")
            if master_card_id is not None:
                wallet_by_master_id.setdefault(master_card_id, []).append(card)
    if not wallet_by_master_id:
        return []

    today_utc = offer_date_cutoff()
    offers = list(
        merchant_offers.find(
            {
                "is_matchable": {"$ne": False},
                "is_archived": {"$ne": True},
                "applicable_master_card_ids": {"$in": list(wallet_by_master_id)},
                **({} if all_days else {"valid_days": target_day}),
                "$or": [
                    {"expires_on": {"$gte": today_utc}},
                    {"expires_on": None},
                ],
            }
        ).sort("merchant_name", ASCENDING)
    )
    return _format_offer_matches(offers, wallet_by_master_id)


@router.get("")
def get_offers(
    _: CurrentUser,
    day: int | None = Query(default=None, ge=0, le=6),
    category: str | None = Query(default=None, min_length=1, max_length=50),
) -> list[dict[str, Any]]:
    filters: dict[str, Any] = {
        "is_matchable": {"$ne": False},
        "is_archived": {"$ne": True},
        "$or": [
            {
                "expires_on": {
                    "$gte": offer_date_cutoff(),
                }
            },
            {"expires_on": None},
        ],
    }
    if day is not None:
        filters["valid_days"] = day
    if category:
        filters["category"] = category.strip().upper()
    return list(
        merchant_offers.find(filters, {"_id": 0}).sort("merchant_name", ASCENDING)
    )
