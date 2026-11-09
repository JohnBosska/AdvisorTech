"""BI report builder: parsing, plan validation and the HTTP contract (no database needed)."""

import importlib.util
import io
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from openpyxl import Workbook

from app.dependencies.organization import get_organization_member
from app.exceptions import BadRequestError, ServiceUnavailableError
from app.schemas.reports import DatasetColumn
from app.services import bi
from app.services.llm_types import LLMResult

COLUMNS = [
    DatasetColumn(name="Месяц", type="date", samples=["2026-01-01"]),
    DatasetColumn(name="Группа", type="text", samples=["Электроника"]),
    DatasetColumn(name="Выручка", type="number", samples=["1200"]),
]


def test_parse_csv_semicolon_cp1251_detects_types() -> None:
    data = "Месяц;Группа;Выручка\n2026-01-01;Электроника;1 200,50\n2026-02-01;Бытовая;800\n".encode(
        "cp1251"
    )
    result = bi.parse_dataset("sales.csv", data)
    assert [c.type for c in result["columns"]] == ["date", "text", "number"]
    assert result["rows"][0]["Выручка"] == 1200.5
    assert result["total_rows"] == 2 and result["truncated"] is False


def test_parse_xlsx_and_duplicate_headers() -> None:
    wb = Workbook()
    ws = wb.active
    ws.append(["Склад", "Склад", "Остаток"])
    ws.append(["Москва", "А", 10])
    buf = io.BytesIO()
    wb.save(buf)
    result = bi.parse_dataset("stock.xlsx", buf.getvalue())
    assert [c.name for c in result["columns"]] == ["Склад", "Склад (2)", "Остаток"]
    assert result["rows"][0]["Остаток"] == 10


@pytest.mark.parametrize(
    ("name", "data"), [("x.pdf", b"%PDF"), ("x.csv", b""), ("x.csv", b"only_header\n")]
)
def test_parse_rejects_bad_input(name: str, data: bytes) -> None:
    with pytest.raises(BadRequestError):
        bi.parse_dataset(name, data)


def test_sanitize_drops_invented_columns_and_wrong_types() -> None:
    raw = {
        "title": "Продажи",
        "widgets": [
            {"type": "kpi", "title": "Итого", "y": "Выручка", "agg": "sum"},
            {"type": "bar", "title": "По группам", "x": "Группа", "y": "Выручка"},
            {"type": "line", "title": "Не дата", "x": "Группа", "y": "Выручка"},
            {"type": "bar", "title": "Выдумка", "x": "Регион", "y": "Выручка"},
            {"type": "kpi", "title": "Текст как мера", "y": "Группа"},
            {"type": "chart3d", "title": "?"},
        ],
    }
    spec, dropped = bi.sanitize_spec(raw, COLUMNS)
    assert [w.title for w in spec.widgets] == ["Итого", "По группам"]
    assert dropped == 4


def test_sanitize_raises_when_nothing_valid() -> None:
    with pytest.raises(ServiceUnavailableError):
        bi.sanitize_spec(
            {"widgets": [{"type": "bar", "title": "x", "x": "Нет", "y": "Нет"}]}, COLUMNS
        )


class FakeLLM:
    seen: list[str] = []

    async def complete(self, system, messages):
        FakeLLM.seen.append(messages[0]["content"])
        return LLMResult(
            text='Вот план: {"title": "Выручка", "widgets": [{"type": "line", "title": "Динамика", "x": "Месяц", "y": "Выручка"}]}',
            model="fake",
        )


def _client(monkeypatch) -> TestClient:
    spec = importlib.util.spec_from_file_location("appmain", "app.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.app.dependency_overrides[get_organization_member] = lambda: SimpleNamespace(
        user_id=1, organization_id=7
    )
    monkeypatch.setattr(bi, "get_llm", lambda: FakeLLM())
    return TestClient(module.app)


def test_http_dataset_and_plan_never_send_rows_to_the_model(monkeypatch) -> None:
    bi._recent.clear()
    client = _client(monkeypatch)
    csv_data = "Месяц,Группа,Выручка\n2026-01-01,Секретная группа 42,100\n2026-02-01,Б,200\n"
    r = client.post(
        "/api/v1/organizations/7/reports/dataset?filename=s.csv", content=csv_data.encode()
    )
    assert r.status_code == 200
    columns = r.json()["columns"]
    for c in columns:
        c["samples"] = []  # the client may send no samples at all
    plan = client.post(
        "/api/v1/organizations/7/reports/plan",
        json={"request": "динамика выручки", "columns": columns},
    )
    assert plan.status_code == 200
    body = plan.json()
    assert body["widgets"][0]["type"] == "line" and body["model"] == "fake"
    assert "Секретная группа 42" not in FakeLLM.seen[-1]


def test_http_rejects_unsupported_file(monkeypatch) -> None:
    client = _client(monkeypatch)
    r = client.post("/api/v1/organizations/7/reports/dataset?filename=a.pdf", content=b"%PDF-1.4")
    assert r.status_code == 400
