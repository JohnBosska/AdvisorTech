from datetime import datetime

from pydantic import BaseModel


class AuditEventResponse(BaseModel):
    id: int
    occurred_at: datetime
    user_id: int | None
    user_name: str | None
    action: str
    action_label: str
    object_type: str | None
    object_id: str | None
    details: dict
    request_id: str | None


class AuditActionResponse(BaseModel):
    action: str
    label: str
