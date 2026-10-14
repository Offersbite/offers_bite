from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator


CardType = Literal["CREDIT", "DEBIT"]
CardNetwork = Literal["VISA", "MASTERCARD", "RUPAY", "AMEX", "DINERS", "OTHER"]


class WalletCardCreate(BaseModel):
    masterCardId: int | None = Field(default=None, gt=0)
    bankName: str | None = Field(default=None, min_length=1, max_length=100)
    cardName: str | None = Field(default=None, min_length=1, max_length=120)
    cardType: CardType | None = None
    network: CardNetwork | None = None
    tierCategory: str | None = Field(default=None, min_length=1, max_length=80)
    cardholderLabel: Literal["Self", "Spouse", "Family"] = "Self"
    customNickname: str | None = Field(default=None, max_length=100)

    @field_validator("bankName", "cardName", "tierCategory", "customNickname")
    @classmethod
    def trim_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        return value or None

    @model_validator(mode="after")
    def validate_card_source(self) -> "WalletCardCreate":
        custom_fields = (
            self.bankName,
            self.cardName,
            self.cardType,
            self.network,
            self.tierCategory,
        )
        if self.masterCardId is not None and any(value is not None for value in custom_fields):
            raise ValueError("Choose either a catalogue card or a custom card, not both.")
        if self.masterCardId is None and not all(value is not None for value in custom_fields):
            raise ValueError(
                "Custom cards require a bank, card name, card type, network, and tier."
            )
        return self
