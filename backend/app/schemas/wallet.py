from typing import Literal

from pydantic import BaseModel, Field


class WalletCardCreate(BaseModel):
    masterCardId: int = Field(gt=0)
    cardholderLabel: Literal["Self", "Spouse", "Family"] = "Self"
    customNickname: str | None = Field(default=None, max_length=100)
