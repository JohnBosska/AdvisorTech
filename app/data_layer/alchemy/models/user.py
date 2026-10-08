from datetime import date
from enum import Enum

from pydantic import EmailStr, TypeAdapter
from pydantic_extra_types.phone_numbers import PhoneNumber
from sqlalchemy import Date, Enum as SqlEnum, String
from sqlalchemy.orm import Mapped, mapped_column, validates

from .base import BaseModel

_email_adapter = TypeAdapter(EmailStr)


class User(BaseModel):
    __tablename__ = "users"

    class RoleEnum(str, Enum):
        UNVERIFIED_USER = 'UNVERIFIED_USER'
        VERIFIED_USER = 'VERIFIED_USER'
        ADMIN = 'ADMIN'

    name: Mapped[str] = mapped_column(String(50), nullable=False)
    phone: Mapped[PhoneNumber] = mapped_column(String(32), nullable=False, unique=True)
    birthday_date: Mapped[date] = mapped_column(Date, nullable=False)
    role: Mapped[RoleEnum] = mapped_column(
        SqlEnum(RoleEnum, name="user_role"),
        nullable=False,
        default=RoleEnum.UNVERIFIED_USER,
    )
    email: Mapped[str] = mapped_column(String(254), nullable=False, unique=True)

    @validates("email")
    def validate_email(self, key: str, value: str) -> str:
        return str(_email_adapter.validate_python(value))
