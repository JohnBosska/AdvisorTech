from datetime import date

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class EmailLoginRequest(BaseModel):
    email: EmailStr
    password: str

    @field_validator("password")
    @classmethod
    def validate_bcrypt_length(cls, value: str) -> str:
        if len(value.encode("utf-8")) > 72:
            raise ValueError("Password must not exceed 72 UTF-8 bytes")
        return value


class EmailRegisterRequest(EmailLoginRequest):
    password: str = Field(min_length=8)
    name: str | None = Field(default=None, max_length=50)


class TelegramOAuthRequest(BaseModel):
    id_token: str


class TelegramWebAppRequest(BaseModel):
    init_data: str


class AccessTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int


class AuthenticatedUserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str | None
    phone: str | None
    birthday_date: date | None
    role: str


class EmailVerificationRequest(EmailLoginRequest):
    code: str = Field(pattern=r"^[0-9]{8}$")


class EmailVerificationPendingResponse(BaseModel):
    detail: str = "Email verification required"
