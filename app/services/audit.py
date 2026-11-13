"""Audit trail. `record` never raises: a failed audit write must not fail the user's action,
but it is logged loudly so it cannot go unnoticed."""

import logging
from typing import Any

from app.context import request_id_var
from app.data_layer.alchemy.api_db import SessionFactory
from app.data_layer.alchemy.models import AuditEvent

logger = logging.getLogger(__name__)

# Catalogue of actions; the UI shows these labels.
ACTIONS: dict[str, str] = {
    "member.invite": "Приглашение участника",
    "member.accept": "Принятие приглашения",
    "member.remove": "Удаление участника",
    "invitation.revoke": "Отзыв приглашения",
    "connection.create": "Создание подключения",
    "agent.credential.issue": "Выпуск токена агента",
    "agent.credential.revoke": "Отзыв токенов агента",
    "sync.request": "Запрос синхронизации",
    "sync.finished": "Завершение синхронизации",
    "connector.credentials.set": "Сохранение учётных данных коннектора",
    "connector.configure": "Настройка сущностей и расписания",
    "knowledge.add": "Добавление документа",
    "knowledge.remove": "Удаление документа",
    "ai.chat": "Вопрос AI-аналитику",
    "ai.report_plan": "Запрос плана отчёта у ИИ",
    "bi.source.file": "Загрузка файла в BI",
    "bi.source.url": "Загрузка по ссылке в BI",
    "bi.source.tables": "Подключение к внешнему источнику",
    "bi.source.load": "Чтение таблицы внешнего источника",
    "bi.report.create": "Создание BI-отчёта",
    "bi.report.update": "Изменение BI-отчёта",
    "bi.report.delete": "Удаление BI-отчёта",
    "bi.report.refresh": "Обновление данных BI-отчёта",
}

_MAX_DETAIL_CHARS = 2000


def _trim(value: Any) -> Any:
    if isinstance(value, str) and len(value) > 300:
        return value[:300] + "…"
    if isinstance(value, dict):
        return {k: _trim(v) for k, v in value.items() if k not in {"password", "token", "secret"}}
    if isinstance(value, list):
        return [_trim(v) for v in value[:20]]
    return value


async def record(
    organization_id: int,
    user_id: int | None,
    action: str,
    *,
    object_type: str | None = None,
    object_id: int | str | None = None,
    details: dict[str, Any] | None = None,
) -> None:
    if action not in ACTIONS:
        raise ValueError(f"Unknown audit action: {action}")
    safe = _trim(details or {})
    try:
        async with SessionFactory.begin() as session:
            await AuditEvent(
                organization_id=organization_id,
                user_id=user_id,
                action=action,
                object_type=object_type,
                object_id=None if object_id is None else str(object_id)[:120],
                details=safe,
                request_id=request_id_var.get(),
            ).save(session)
    except Exception:  # pragma: no cover - only on database failure
        logger.exception("audit write failed: %s org=%s user=%s", action, organization_id, user_id)
