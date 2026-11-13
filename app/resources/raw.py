"""Raw layer writer shared by the agent API and server-side connectors."""

from datetime import datetime, timezone

from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.data_layer.alchemy.models import RawRecord


async def upsert_raw_records(
    session,
    *,
    organization_id: int,
    connection_id: int,
    run_id: int | None,
    entity: str,
    records: list[tuple[str, dict]],
) -> None:
    """Same key from the same connection replaces the previous payload."""
    if not records:
        return
    now = datetime.now(timezone.utc)
    stmt = pg_insert(RawRecord).values(
        [
            {
                "organization_id": organization_id,
                "connection_id": connection_id,
                "sync_run_id": run_id,
                "entity": entity,
                "record_key": key[:200],
                "payload": data,
                "created_at": now,
                "updated_at": now,
                "is_deleted": False,
            }
            for key, data in records
        ]
    )
    await session.execute(
        stmt.on_conflict_do_update(
            constraint="uq_raw_record_key",
            set_={
                "payload": stmt.excluded.payload,
                "sync_run_id": stmt.excluded.sync_run_id,
                "ingested_at": now,
                "updated_at": now,
                "is_deleted": False,
            },
        )
    )
