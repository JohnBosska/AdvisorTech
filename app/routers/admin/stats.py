from uuid import UUID

from fastapi import APIRouter, Depends

from app import schemas
from app.security import require_admin

router = APIRouter(
    prefix="/api/v1/admin/stats",
    tags=["Admin · Statistics"],
    dependencies=[Depends(require_admin)],
)


@router.get("/services/popular", response_model=list[schemas.PopularService])
def popular_services():
    """Какие услуги заказывают чаще всего."""
    return []


@router.get("/users/{guest_id}", response_model=schemas.UserStats)
def user_stats(guest_id: UUID):
    """Статистика по конкретному пользователю: что и с чем заказывает."""
    return schemas.UserStats(
        guest_id=guest_id, total_bookings=0, favorite_services=[], total_spent=0
    )
