# Salon Booking API

## Локальный запуск

Установите [uv](https://docs.astral.sh/uv/getting-started/installation/).
Проект использует Python 3.14; uv автоматически установит его при необходимости.

```bash
uv sync --locked
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Swagger UI: http://localhost:8000/docs. Проверка сервиса: http://localhost:8000/health.

## Зависимости

Прямые зависимости описаны в `pyproject.toml`, точные версии всех зависимостей
зафиксированы в `uv.lock`. Оба файла нужно хранить в Git.

```bash
uv add <package>
uv remove <package>
uv lock --upgrade
uv sync --locked
```

`uv lock --upgrade` обновляет зависимости в пределах ограничений `pyproject.toml`.
Для обновления зависимости с точной версией используйте `uv add <package>==<version>`.

## Docker

```bash
docker compose up --build
```

Docker устанавливает зависимости из `uv.lock` через `uv sync --locked --no-dev`.
Сервис доступен на порту 8000.
