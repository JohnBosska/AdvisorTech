from datetime import datetime, timezone
from io import BytesIO

from openpyxl import load_workbook

from app.data_layer.alchemy.models import ChatMessage
from app.services.report import build_report, spreadsheet_safe


def test_formula_like_text_is_neutralised() -> None:
    assert spreadsheet_safe('=HYPERLINK("http://x")') == '\'=HYPERLINK("http://x")'
    assert spreadsheet_safe("+1") == "'+1" and spreadsheet_safe("@cmd") == "'@cmd"
    assert spreadsheet_safe("обычный текст") == "обычный текст" and spreadsheet_safe(5) == 5


def test_report_has_four_sheets_built_from_stored_data() -> None:
    answer = ChatMessage(
        role=ChatMessage.RoleEnum.ASSISTANT,
        content="=SUM(A1) Ответ [1]",
        sources=[{"ref": 1, "title": "Регламент", "snippet": "текст", "uploaded_at": "2026-11-02"}],
        refusal=False,
        model="GigaChat",
        trace=[
            {"id": "validation", "status": "completed", "summary": "Проверено", "duration_ms": 3}
        ],
        created_at=datetime(2026, 11, 2, tzinfo=timezone.utc),
    )
    wb = load_workbook(BytesIO(build_report("Вопрос?", answer, "ООО Тест")))
    assert wb.sheetnames == ["Сводка", "Источники", "Допущения", "Трасса"]
    summary = {row[0].value: row[1].value for row in wb["Сводка"].iter_rows(min_row=2)}
    assert summary["Ответ"].startswith("'=SUM") and summary["Организация"] == "ООО Тест"
    assert wb["Источники"]["B2"].value == "Регламент"
