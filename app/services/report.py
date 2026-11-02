"""XLSX report for one AI answer. Built only from what was stored: nothing is recalculated."""

from io import BytesIO

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font

from app.data_layer.alchemy.models import ChatMessage

STAGE_TITLES = {
    "query_analysis": "Анализ запроса",
    "access_control": "Контроль доступа",
    "fulltext_retrieval": "Полнотекстовый поиск",
    "vector_retrieval": "Векторный поиск (pgvector)",
    "sql_analytics": "SQL-аналитика PostgreSQL",
    "reranking": "Ранжирование",
    "context_assembly": "Сборка контекста",
    "llm_generation": "Генерация ответа",
    "validation": "Проверка ответа",
    "final_answer": "Итоговый ответ",
}
STATUS_TITLES = {
    "completed": "выполнено",
    "warning": "предупреждение",
    "failed": "ошибка",
    "skipped": "пропущено",
    "idle": "не запускалось",
    "running": "выполняется",
}
ASSUMPTIONS = [
    "Ответ основан только на документах, загруженных организацией в базу знаний.",
    "Данные учётной системы 1С в расчётах не использовались: хранилище данных не подключено.",
    "Числа в ответе не пересчитывались платформой; проверка лишь сверяет их с текстом источников.",
    "Интерпретации и рекомендации сформированы моделью и требуют оценки собственника.",
]


def spreadsheet_safe(value: object) -> object:
    """Neutralise formula injection: text starting with = + - @ would run as a formula in Excel."""
    if isinstance(value, str) and value[:1] in {"=", "+", "-", "@", "\t", "\r"}:
        return "'" + value
    return value


def _write(ws, rows: list[list[object]], widths: list[int]) -> None:
    for row in rows:
        ws.append([spreadsheet_safe(c) for c in row])
    for index, width in enumerate(widths, start=1):
        ws.column_dimensions[chr(64 + index)].width = width
    for row in ws.iter_rows():
        for cell in row:
            cell.alignment = Alignment(wrap_text=True, vertical="top")
    for cell in ws[1]:
        cell.font = Font(bold=True)


def build_report(question: str, answer: ChatMessage, organization_name: str) -> bytes:
    wb = Workbook()
    summary = wb.active
    summary.title = "Сводка"
    validation = next((s for s in answer.trace if s["id"] == "validation"), None)
    _write(
        summary,
        [
            ["Поле", "Значение"],
            ["Организация", organization_name],
            ["Вопрос", question],
            ["Ответ", answer.content],
            ["Модель", answer.model or "не вызывалась (нет источников)"],
            ["Сформировано", answer.created_at.isoformat(timespec="seconds")],
            ["Проверка ответа", (validation or {}).get("summary", "не выполнялась")],
            [
                "Статус",
                "отказ: нет подходящих документов" if answer.refusal else "ответ по источникам",
            ],
        ],
        [24, 100],
    )

    sources = wb.create_sheet("Источники")
    _write(
        sources,
        [["№", "Документ", "Загружен", "Фрагмент"]]
        + [[s["ref"], s["title"], s.get("uploaded_at", ""), s["snippet"]] for s in answer.sources]
        or [["№", "Документ", "Загружен", "Фрагмент"]],
        [6, 40, 28, 90],
    )

    assumptions = wb.create_sheet("Допущения")
    _write(assumptions, [["Допущения и ограничения"]] + [[a] for a in ASSUMPTIONS], [120])

    trace = wb.create_sheet("Трасса")
    _write(
        trace,
        [["Этап", "Статус", "Время, мс", "Элементов", "Комментарий"]]
        + [
            [
                STAGE_TITLES.get(s["id"], s["id"]),
                STATUS_TITLES.get(s["status"], s["status"]),
                s.get("duration_ms"),
                s.get("count"),
                s.get("summary", ""),
            ]
            for s in answer.trace
        ],
        [30, 18, 12, 12, 80],
    )
    buffer = BytesIO()
    wb.save(buffer)
    return buffer.getvalue()
