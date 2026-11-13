from dataclasses import dataclass


@dataclass
class SyncJob:
    """Temporal payload (dataclass: the default data converter handles it)."""

    run_id: int | None
    organization_id: int
    connection_id: int
    mode: str = "INCREMENTAL"
