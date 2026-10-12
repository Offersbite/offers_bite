from pydantic import BaseModel, EmailStr, Field, field_validator


class AccountRegistration(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: EmailStr = Field(max_length=100)
    password: str = Field(min_length=8, max_length=128)

    @field_validator("name")
    @classmethod
    def name_must_not_be_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Name must not be blank")
        return value


class LoginRequest(BaseModel):
    email: EmailStr = Field(max_length=100)
    password: str = Field(min_length=1, max_length=128)


class VerifyEmailRequest(BaseModel):
    email: EmailStr = Field(max_length=100)
    otp: str = Field(pattern=r"^\d{4}$")


class ResendOtpRequest(BaseModel):
    email: EmailStr = Field(max_length=100)
