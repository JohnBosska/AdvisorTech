from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.data_layer.alchemy.models import OrganizationMember, Subscription


class OrganizationCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    legal_name: str | None = Field(default=None, max_length=255)
    tax_id: str | None = Field(default=None, pattern=r"^[0-9]{10}([0-9]{2})?$")
    uses_onec: bool | None = None


class SubscriptionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    plan: str
    status: Subscription.StatusEnum
    current_period_end: datetime | None


class OrganizationResponse(BaseModel):
    id: int
    name: str
    legal_name: str | None
    tax_id: str | None
    reporting_currency: str
    uses_onec: bool | None
    role: OrganizationMember.RoleEnum
    subscription: SubscriptionResponse | None
