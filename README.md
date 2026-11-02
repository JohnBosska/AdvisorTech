# Tech Adviser

AI-платформа бизнес-аналитики для малого и среднего бизнеса на данных 1С: интеграция с 1С, облачная
аналитическая PostgreSQL, сквозная аналитика, отчётность для собственника, ориентированная на РСБУ,
AI-аналитик и Excel-отчёты. Это слой аналитики поверх 1С, а не её замена.
Бизнес-требования: [`docs/PROJECT_BUSINESS_ANALYSIS_BRIEF_RU.md`](docs/PROJECT_BUSINESS_ANALYSIS_BRIEF_RU.md).
Архитектура и статус реализации: [`ARCHITECTURE.md`](ARCHITECTURE.md), [`docs/FRONTEND_STATUS.md`](docs/FRONTEND_STATUS.md).

## Frontend

Веб-приложение разрабатывается на React, TypeScript и Vite (каталог [`frontend/`](frontend)).

- [Архитектура frontend](./FRONTEND_ARCHITECTURE.md)
- [Дизайн-система](./FRONTEND_DESIGN_SYSTEM.md)
- [Мультиагентный процесс](./FRONTEND_AGENTS.md)

Публичный сайт и кабинет собственника выполнены в тёмном технологичном стиле с мятно-зелёными акцентами.
В hero лендинга — интерактивный ноутбук с мозгом из символов (React Three Fiber). Данные, которых ещё нет
в backend, показываются как «Демо-данные».

```bash
cd frontend && npm ci && npm run dev   # http://localhost:5173, /api проксируется на :8000
```

## Локальный запуск

Установите [uv](https://docs.astral.sh/uv/getting-started/installation/).
Проект использует Python 3.14; uv автоматически установит его при необходимости.

```bash
uv sync --locked
uv run bash cmd/run_app.sh
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

Compose запускает API, PostgreSQL, Temporal dev server и отдельный Temporal worker.
API доступен на порту 8000, Temporal UI — на порту 8233. Для отправки email
задайте `EMAIL_HOST`, `EMAIL_USERNAME`, `EMAIL_PASSWORD` и `EMAIL_SENDER` в `.env`.
Temporal dev server хранит историю в памяти и предназначен только для локальной
разработки.
Для разработки worker можно запустить отдельно: `uv run bash cmd/run_worker.sh`.
Вход поддерживает `POST /api/v1/auth/email/register`, `POST /api/v1/auth/email/login`,
`POST /api/v1/auth/telegram/oauth` и `POST /api/v1/auth/telegram/webapp`; успешный
вход возвращает JWT. Текущий пользователь доступен через `GET /api/v1/auth/me`.
Для JWT задайте `AUTH_JWT_SECRET`, для Telegram — `TELEGRAM_BOT_TOKEN` и
`TELEGRAM_CLIENT_ID`.

Docker устанавливает зависимости из `uv.lock` через `uv sync --locked --no-dev`.

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

Авторизация использует PostgreSQL через async SQLAlchemy.
Для новой базы примените миграции: `uv run alembic upgrade head`
(в Docker: `docker compose run --rm api alembic upgrade head`).
Если таблицы уже создавались вручную, сначала сравните их с `0001_user_identities`:
первичная миграция не предназначена для запуска поверх существующих таблиц.

## Подтверждение email

1. `POST /api/v1/auth/email/register` с `email`, `password`, необязательным `name`
   создаёт пользователя и ставит письмо в очередь Temporal. Ответ `201`:
   `{"detail": "Email verification required"}`. JWT пока не выдаётся.
2. `POST /api/v1/auth/email/verify` с `email`, `password`, `code` подтверждает
   адрес и возвращает JWT. Код — строка из 8 цифр, действителен 10 минут,
   допускает 5 неверных попыток. Использованный код повторно не принимается.
3. `POST /api/v1/auth/email/resend` с `email`, `password` выдаёт новый код,
   аннулируя предыдущий. Ответ `202`; повторный запрос раньше 60 секунд
   возвращает `429` с `Retry-After`.

До подтверждения вход по email возвращает `403`. Существующие адреса после
миграции также считаются неподтверждёнными: запросите код через `/email/resend`.
Неверный/просроченный код возвращает `400`, неверный пароль — `401`.
Коды не возвращаются в API; в БД хранится HMAC-хеш.

Для писем должны работать Temporal server, worker и SMTP. Ответ регистрации
подтверждает постановку письма в очередь, а не доставку. Если постановка
не удалась, API возвращает `503`; аккаунт остаётся созданным, код можно
запросить повторно через `/email/resend` после истечения интервала.
Сбой процесса между commit и постановкой письма также требует повторного
запроса; транзакционного outbox пока нет.

Транзакции записи открываются явно в resources через `SessionFactory.begin()`:
успешный выход делает commit, исключение — rollback. Методы моделей выполняют
только запросы и flush; сессия передаётся им аргументом.
