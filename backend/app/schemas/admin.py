from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator


class AdminUserUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    role: Literal["user", "admin"] | None = None
    is_active: bool | None = None

    @field_validator("name")
    @classmethod
    def trim_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError("Name must not be blank.")
        return value

    @model_validator(mode="after")
    def require_update(self) -> "AdminUserUpdate":
        if self.name is None and self.role is None and self.is_active is None:
            raise ValueError("Provide a name, role, or account status to update.")
        return self


class MasterCardData(BaseModel):
    bank_name: str = Field(min_length=1, max_length=100)
    card_name: str = Field(min_length=1, max_length=120)
    card_type: Literal["CREDIT", "DEBIT"]
    network: Literal["VISA", "MASTERCARD", "RUPAY", "AMEX", "DINERS", "OTHER"]

    @field_validator("bank_name", "card_name")
    @classmethod
    def trim_required_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("This field must not be blank.")
        return value


class OfferData(BaseModel):
    merchant_name: str = Field(min_length=1, max_length=120)
    category: str = Field(min_length=1, max_length=50)
    offer_headline: str = Field(min_length=1, max_length=240)
    coupon_code: str | None = Field(default=None, max_length=80)
    min_spend: float = Field(default=0, ge=0)
    max_discount: float | None = Field(default=None, ge=0)
    valid_days: list[int] = Field(default_factory=list, max_length=7)
    applicable_master_card_ids: list[int] = Field(default_factory=list, max_length=500)
    expires_on: datetime | None = None
    is_matchable: bool = True

    @field_validator("merchant_name", "category", "offer_headline")
    @classmethod
    def trim_required_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("This field must not be blank.")
        return value

    @field_validator("category")
    @classmethod
    def normalize_category(cls, value: str) -> str:
        return value.upper()

    @field_validator("coupon_code")
    @classmethod
    def normalize_coupon_code(cls, value: str | None) -> str | None:
        value = value.strip() if value else ""
        return value or None

    @field_validator("valid_days")
    @classmethod
    def validate_days(cls, value: list[int]) -> list[int]:
        if any(day < 0 or day > 6 for day in value):
            raise ValueError("Valid days must be between 0 (Sunday) and 6 (Saturday).")
        if len(set(value)) != len(value):
            raise ValueError("Valid days must not contain duplicates.")
        return value

    @field_validator("applicable_master_card_ids")
    @classmethod
    def validate_card_ids(cls, value: list[int]) -> list[int]:
        if any(card_id <= 0 for card_id in value):
            raise ValueError("Card IDs must be positive.")
        if len(set(value)) != len(value):
            raise ValueError("Applicable card IDs must not contain duplicates.")
        return value

    @field_validator("expires_on")
    @classmethod
    def normalize_expiry(cls, value: datetime | None) -> datetime | None:
        if value is None:
            return None
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)

    @model_validator(mode="after")
    def validate_matchable_offer(self) -> "OfferData":
        if self.is_matchable and not self.applicable_master_card_ids:
            raise ValueError("Matchable offers must include at least one eligible card.")
        if self.is_matchable and not self.valid_days:
            raise ValueError("Matchable offers must include at least one valid day.")
        return self
