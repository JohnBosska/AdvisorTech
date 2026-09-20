from datetime import datetime

from fastapi import APIRouter, Depends

from app import schemas, storage
from app.security import require_admin

router = APIRouter(
    prefix="/api/v1/admin/integrations/1c",
    tags=["Admin · 1C Integration (после MVP)"],
    dependencies=[Depends(require_admin)],
)


@router.get("/orders", response_model=list[schemas.OneCOrderExport])
def export_orders():
    """Агрегированная выгрузка заказов для 1С (бухгалтерия, налоги)."""
    orders = []
    for payment in storage.payments.values():
        orders.append(
            schemas.OneCOrderExport(
                booking_id=payment["booking_id"],
                amount=payment["amount"],
                status=payment["status"],
                created_at=payment["created_at"],
            )
        )
    return orders


@router.post("/sync", response_model=schemas.OneCSyncResponse)
def sync_orders():
    """Инициировать синхронизацию заказов с 1С через API 1С."""
    return schemas.OneCSyncResponse(synced_count=len(storage.payments), synced_at=datetime.utcnow())
