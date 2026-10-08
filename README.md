# Salon Booking API

## Локальный запуск

Установите [uv](https://docs.astral.sh/uv/getting-started/installation/).
Проект использует Python 3.14; uv автоматически установит его при необходимости.

```bash
uv sync --locked
uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000
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

Перед первым запуском скопируйте `.env.example` в `.env` и задайте
`POSTGRES_PASSWORD`:

```bash
cp .env.example .env
```

```bash
docker compose up --build
```

Docker устанавливает зависимости из `uv.lock` через `uv sync --locked --no-dev`.
Сервис доступен на порту 8000.

## PostgreSQL 18

Запуск только базы данных с ожиданием готовности:

```bash
docker compose up -d --wait postgres
```

С хоста подключайтесь к `127.0.0.1:${POSTGRES_PORT}` (по умолчанию `5432`),
из контейнера API — к `postgres:5432`. Имя базы, пользователь и пароль
задаются в `.env` переменными `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`.

Проверка SQL-подключения:

```bash
docker compose exec postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT version();"'
```

Данные сохраняются в томе `postgres_data`, смонтированном в
`/var/lib/postgresql` согласно [инструкции для PostgreSQL 18](https://docs.docker.com/guides/postgresql/).
`docker compose down` сохраняет том; `docker compose down -v` удаляет данные.
Переменные `POSTGRES_*` применяются при инициализации пустого тома;
изменение `.env` не меняет пользователей и пароли существующей базы.

API пока использует хранилище в памяти. Async-подключение SQLAlchemy и Alembic
настроены; ORM-модели предметной области и первая миграция ещё не добавлены.
