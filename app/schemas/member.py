from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr

from app.data_layer.alchemy.models import OrganizationMember


class MemberResponse(BaseModel):
    id: int
    user_id: int
    name: str | None
    email: str | None
    role: OrganizationMember.RoleEnum


class MemberRoleUpdateRequest(BaseModel):
    role: OrganizationMember.RoleEnum


class InvitationCreateRequest(BaseModel):
    email: EmailStr
    role: OrganizationMember.RoleEnum


class InvitationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    role: OrganizationMember.RoleEnum
    expires_at: datetime


class InvitationCreatedResponse(InvitationResponse):
    """The token is returned once; only its hash is stored. Email delivery is not implemented."""

    token: str


class InvitationAcceptRequest(BaseModel):
    token: str
