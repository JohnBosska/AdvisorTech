from app.connectors.base import ColumnInfo, Connector, Page, TableInfo
from app.connectors.onec_odata import OneCODataConnector
from app.connectors.postgres import PostgresConnector
from app.exceptions import BadRequestError

KINDS: dict[str, type] = {
    PostgresConnector.kind: PostgresConnector,
    OneCODataConnector.kind: OneCODataConnector,
}
DEFAULT_KEY = {"postgres": "id", "onec_odata": "Ref_Key"}


def make_connector(kind: str, creds: dict) -> Connector:
    cls = KINDS.get(kind)
    if cls is None:
        raise BadRequestError(f"Неизвестный тип коннектора: {kind}")
    return cls(creds)


__all__ = ["ColumnInfo", "Connector", "DEFAULT_KEY", "KINDS", "Page", "TableInfo", "make_connector"]
