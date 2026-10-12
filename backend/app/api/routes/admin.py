import re
from hashlib import sha256
from datetime import datetime, timezone
from typing import Any, Literal

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, File, HTTPException, Query, Response, UploadFile
from pymongo import ASCENDING, DESCENDING, ReturnDocument
from pymongo.errors import DuplicateKeyError, PyMongoError

from app.db.mongo import (
    master_cards,
    merchant_offers,
    pending_registrations,
    sessions,
    users,
)
from app.dependencies.auth import AdminUser
from app.schemas.admin import AdminUserUpdate, MasterCardData, OfferData
from app.schemas.auth import AccountRegistration
from app.services.catalogue import new_catalogue_id
from app.services.auth import hash_password, issue_email_otp
from app.services.offer_import import (
    MAX_UPLOAD_BYTES,
    OfferWorkbookError,
    import_offer_rows,
    parse_offer_workbook,
)


router = APIRouter(prefix="/admin", tags=["admin"])


def _user_record(user: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(user["_id"]),
        "name": user["name"],
        "email": user["email"],
        "role": user.get("role", "user"),
        "is_active": user.get("isActive", True),
        "email_verified": bool(user.get("emailVerifiedAt")),
        "created_at": user.get("createdAt"),
        "wallet_count": len(user.get("wallet_cards", [])),
    }


def _object_id(value: str) -> ObjectId:
    try:
        return ObjectId(value)
    except (InvalidId, TypeError) as exc:
        raise HTTPException(status_code=404, detail="User not found.") from exc


def _validate_card_references(card_ids: list[int]) -> None:
    found_ids = {
        card["id"]
        for card in master_cards.find(
            {"id": {"$in": card_ids}},
            {"id": 1},
        )
    }
    missing_ids = sorted(set(card_ids) - found_ids)
    if missing_ids:
        raise HTTPException(
            status_code=422,
            detail=f"Unknown master card IDs: {', '.join(map(str, missing_ids))}.",
        )


def _card_is_referenced(card_id: int) -> bool:
    return bool(
        users.find_one(
            {"wallet_cards.master_card_id": card_id},
            {"_id": 1},
        )
        or merchant_offers.find_one(
            {"applicable_master_card_ids": card_id},
            {"_id": 1},
        )
    )


def _admin_offer(offer: dict[str, Any]) -> dict[str, Any]:
    result = {key: value for key, value in offer.items() if key != "_id"}
    return result


@router.get("/summary")
def get_admin_summary(_: AdminUser) -> dict[str, int]:
    return {
        "users": users.count_documents({}),
        "active_users": users.count_documents({"isActive": {"$ne": False}}),
        "cards": master_cards.count_documents({}),
        "offers": merchant_offers.count_documents({}),
        "active_offers": merchant_offers.count_documents(
            {
                "is_matchable": {"$ne": False},
                "valid_days": {"$ne": []},
                "$or": [
                    {"expires_on": {"$gte": datetime.now(timezone.utc)}},
                    {"expires_on": None},
                ],
            }
        ),
    }


@router.get("/users")
def get_admin_users(
    _: AdminUser,
    search: str | None = Query(default=None, max_length=100),
    role: Literal["user", "admin"] | None = Query(default=None),
    status: Literal["active", "inactive"] | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> dict[str, Any]:
    filters: dict[str, Any] = {}
    if role:
        filters["role"] = role
    if status == "active":
        filters["isActive"] = {"$ne": False}
    elif status == "inactive":
        filters["isActive"] = False
    if search and search.strip():
        safe_search = re.escape(search.strip())
        filters["$and"] = [{"$or": [
            {"name": {"$regex": safe_search, "$options": "i"}},
            {"email": {"$regex": safe_search, "$options": "i"}},
        ]}]
    total = users.count_documents(filters)
    records = users.find(filters).sort("createdAt", DESCENDING).skip(offset).limit(limit)
    return {"items": [_user_record(user) for user in records], "total": total}


@router.post("/users", status_code=202)
def create_admin_user(account: AccountRegistration, _: AdminUser) -> dict[str, str]:
    email = str(account.email).lower()
    if users.find_one({"email": email}, {"_id": 1}):
        raise HTTPException(
            status_code=409,
            detail="An account with this email already exists.",
        )
    issue_email_otp(
        email=email,
        name=account.name,
        password_hash=hash_password(account.password),
    )
    return {"email": email, "message": "Verification code sent."}


@router.patch("/users/{user_id}")
def update_admin_user(
    user_id: str,
    changes: AdminUserUpdate,
    admin: AdminUser,
) -> dict[str, Any]:
    target_id = _object_id(user_id)
    target = users.find_one({"_id": target_id})
    if not target:
        raise HTTPException(status_code=404, detail="User not found.")
    changes_access = changes.role is not None or changes.is_active is not None
    if target_id == admin["_id"] and changes_access:
        raise HTTPException(
            status_code=409,
            detail="You cannot change your own administrator access or account status.",
        )
    if changes.role == "admin" and not target.get("emailVerifiedAt"):
        raise HTTPException(
            status_code=409,
            detail="Only verified accounts can be administrators.",
        )

    role = changes.role if changes.role is not None else target.get("role", "user")
    is_active = (
        changes.is_active
        if changes.is_active is not None
        else target.get("isActive", True)
    )
    loses_admin_access = target.get("role", "user") == "admin" and (
        role != "admin" or not is_active
    )
    if loses_admin_access:
        active_admins = users.count_documents(
            {"role": "admin", "isActive": {"$ne": False}}
        )
        if active_admins <= 1:
            raise HTTPException(
                status_code=409,
                detail="The last active administrator cannot be demoted or deactivated.",
            )

    now = datetime.now(timezone.utc)
    update: dict[str, Any] = {"updatedAt": now}
    if changes.name is not None:
        update["name"] = changes.name
    if changes.role is not None:
        update["role"] = changes.role
    if changes.is_active is not None:
        update["isActive"] = changes.is_active
    users.update_one({"_id": target_id}, {"$set": update})
    if changes.is_active is False:
        sessions.delete_many({"userId": target_id})
    updated = users.find_one({"_id": target_id})
    if not updated:
        raise HTTPException(status_code=404, detail="User not found.")
    return _user_record(updated)


@router.delete("/users/{user_id}", status_code=204)
def delete_admin_user(user_id: str, admin: AdminUser) -> Response:
    target_id = _object_id(user_id)
    target = users.find_one({"_id": target_id}, {"email": 1, "role": 1, "isActive": 1})
    if not target:
        raise HTTPException(status_code=404, detail="User not found.")
    if target_id == admin["_id"]:
        raise HTTPException(status_code=409, detail="You cannot delete your own account.")
    is_active_admin = target.get("role", "user") == "admin" and target.get("isActive", True)
    if is_active_admin:
        active_admins = users.count_documents(
            {"role": "admin", "isActive": {"$ne": False}}
        )
        if active_admins <= 1:
            raise HTTPException(
                status_code=409,
                detail="The last active administrator cannot be deleted.",
            )

    users.delete_one({"_id": target_id})
    sessions.delete_many({"userId": target_id})
    pending_registrations.delete_many({"email": target["email"]})
    return Response(status_code=204)


@router.get("/cards")
def get_admin_cards(_: AdminUser) -> list[dict[str, Any]]:
    return list(
        master_cards.find({}, {"_id": 0}).sort(
            [("bank_name", ASCENDING), ("card_name", ASCENDING)]
        )
    )


@router.post("/cards", status_code=201)
def create_admin_card(card: MasterCardData, _: AdminUser) -> dict[str, Any]:
    record = card.model_dump()
    record["id"] = new_catalogue_id("master_cards", master_cards)
    try:
        master_cards.insert_one(record)
    except DuplicateKeyError as exc:
        raise HTTPException(
            status_code=409,
            detail="A card with this catalogue ID already exists. Retry the request.",
        ) from exc
    return record


@router.patch("/cards/{card_id}")
def update_admin_card(
    card_id: int,
    card: MasterCardData,
    _: AdminUser,
) -> dict[str, Any]:
    updated = master_cards.find_one_and_update(
        {"id": card_id},
        {"$set": card.model_dump()},
        return_document=ReturnDocument.AFTER,
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Card not found.")
    updated.pop("_id", None)
    return updated


@router.delete("/cards/{card_id}", status_code=204)
def delete_admin_card(card_id: int, _: AdminUser) -> Response:
    if _card_is_referenced(card_id):
        raise HTTPException(
            status_code=409,
            detail="This card is used by a household wallet or offer and cannot be deleted.",
        )
    result = master_cards.delete_one({"id": card_id})
    if not result.deleted_count:
        raise HTTPException(status_code=404, detail="Card not found.")
    return Response(status_code=204)


@router.get("/offers")
def get_admin_offers(_: AdminUser) -> list[dict[str, Any]]:
    return [
        _admin_offer(offer)
        for offer in merchant_offers.find({}, {"_id": 0}).sort(
            "merchant_name", ASCENDING
        )
    ]


@router.post("/offers/bulk-upload", status_code=201)
async def bulk_upload_admin_offers(
    _: AdminUser,
    file: UploadFile = File(...),
) -> dict[str, Any]:
    source_file = (file.filename or "").replace("\\", "/").rsplit("/", 1)[-1].strip()
    if not source_file.lower().endswith(".xlsx"):
        raise HTTPException(
            status_code=422,
            detail="Choose an .xlsx Excel workbook.",
        )
    try:
        content = await file.read(MAX_UPLOAD_BYTES + 1)
    finally:
        await file.close()

    try:
        rows = parse_offer_workbook(content)
    except OfferWorkbookError as exc:
        raise HTTPException(
            status_code=422,
            detail={"message": str(exc), "errors": exc.errors},
        ) from exc

    source_hash = sha256(content).hexdigest()
    try:
        result = import_offer_rows(
            rows,
            source_file=source_file,
            source_hash=source_hash,
        )
    except OfferWorkbookError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={"message": str(exc), "errors": exc.errors},
        ) from exc
    except PyMongoError as exc:
        raise HTTPException(
            status_code=500,
            detail={
                "message": "MongoDB could not save the uploaded offers.",
                "errors": [{"message": f"Database write failed ({type(exc).__name__})."}],
            },
        ) from exc

    if result["missing_rows"] or result["errors"]:
        raise HTTPException(
            status_code=500,
            detail={
                "message": "The import was incomplete. Review the row errors and retry.",
                "errors": result["errors"],
                "missing_rows": result["missing_rows"],
                "result": result,
            },
        )
    return result


@router.post("/offers", status_code=201)
def create_admin_offer(offer: OfferData, _: AdminUser) -> dict[str, Any]:
    offer_data = offer.model_dump()
    _validate_card_references(offer_data["applicable_master_card_ids"])
    offer_data["id"] = new_catalogue_id("merchant_offers", merchant_offers)
    try:
        merchant_offers.insert_one(offer_data)
    except DuplicateKeyError as exc:
        raise HTTPException(
            status_code=409,
            detail="An offer with this catalogue ID already exists. Retry the request.",
        ) from exc
    return offer_data


@router.patch("/offers/{offer_id}")
def update_admin_offer(
    offer_id: int,
    offer: OfferData,
    _: AdminUser,
) -> dict[str, Any]:
    offer_data = offer.model_dump()
    _validate_card_references(offer_data["applicable_master_card_ids"])
    updated = merchant_offers.find_one_and_update(
        {"id": offer_id},
        {"$set": offer_data},
        return_document=ReturnDocument.AFTER,
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Offer not found.")
    updated.pop("_id", None)
    return _admin_offer(updated)


@router.delete("/offers/{offer_id}", status_code=204)
def delete_admin_offer(offer_id: int, _: AdminUser) -> Response:
    result = merchant_offers.delete_one({"id": offer_id})
    if not result.deleted_count:
        raise HTTPException(status_code=404, detail="Offer not found.")
    return Response(status_code=204)
