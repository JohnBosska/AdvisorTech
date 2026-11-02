# Tech Adviser — архитектура

Источник бизнес-требований: [`docs/PROJECT_BUSINESS_ANALYSIS_BRIEF_RU.md`](docs/PROJECT_BUSINESS_ANALYSIS_BRIEF_RU.md).
Tech Adviser — AI-платформа бизнес-аналитики для МСП на данных 1С: слой аналитики и поддержки решений
поверх учётной системы, а не её замена. Интеграция с 1С — только на чтение.

Стек не менялся: Python 3.14, FastAPI (модульный монолит), SQLAlchemy 2 async, Alembic, PostgreSQL 18,
Temporal, `uv`. Frontend: React 19 + TypeScript + Vite (см. [FRONTEND_ARCHITECTURE.md](FRONTEND_ARCHITECTURE.md)).

## Что реализовано в backend

| Модуль | Состояние |
|---|---|
| Auth (email + код подтверждения, Telegram, JWT) | Работает, проверено |
| Tenants / Organizations | `organizations`, `organization_members` (роли `OWNER`, `FINANCE`, `ANALYST`, `IT_ADMIN`). Проверка членства на каждом запросе: чужая организация даёт 404 |
| Subscriptions | Только состояние (`PENDING`/`ACTIVE`/…). Цены, пробный период и лимиты не определены; биллинга нет |
| Integrations / 1C | Записи подключений `source_connections` (всегда чтение, статус `DRAFT`), история `sync_runs` (чтение). Подключений к 1С нет |
| Сессии | Refresh-токен в HttpOnly-cookie `ta_refresh` (путь `/api/v1/auth`), ротация и отзыв семейства при повторном использовании: `POST /auth/refresh`, `POST /auth/logout` |
| Участники | Список, смена роли, удаление (только `OWNER`, всегда остаётся хотя бы один владелец); приглашения по email с одноразовым токеном (письмо не отправляется — токен отдаётся владельцу) |
| Connector Agent API | Токен агента на одно подключение (`agt_…`, хранится хеш). `/api/v1/agent/*`: heartbeat, очередь запусков, start, пакеты (идемпотентны по `sequence`), finish. Хранится только журнал счётчиков: данные записей не сохраняются, Data Warehouse не построен |
| AI-аналитик (RAG) | База знаний организации: документы режутся на фрагменты (`knowledge_chunks`), поиск = полнотекстовый `russian` + векторный **pgvector** (HNSW, cosine), результаты сливаются RRF. Векторы включаются ключом `AI_EMBEDDING_API_KEY` (Voyage); без него работает только полнотекстовый поиск. Любой запрос фильтруется по `organization_id`. Чат: `/organizations/{id}/chat/...`, ответ строго по найденным источникам со ссылками `[N]`, при отсутствии источников модель не вызывается. LLM — Anthropic (`AI_ANTHROPIC_API_KEY`); без ключа 503. Данных 1С в ответах нет: хранилище не построено |
| Миграция | `0003_tenants_integrations`, `0004_sessions_members_agents`, `0005_knowledge_and_chat` (расширение `vector`; применены на PostgreSQL 18 при старте compose) |

API: `POST/GET /api/v1/organizations`, `GET /api/v1/organizations/{id}`,
`GET/POST /api/v1/organizations/{id}/connections`, `GET .../connections/{cid}/sync-runs`.

## Запланировано (в backend нет)

Connector Registry и Connector Agent, Integration Gateway, Ingestion (пакеты, повторы, идемпотентность),
Data Warehouse (Raw/Staging/Core/Marts, развёртывание отдельной PostgreSQL на клиента), Data Quality,
Analytics/KPI Dictionary, Inventory, Logistics, Financial Reporting (сопоставление счетов, РСБУ),
AI-инструменты SQL/Python над Data Warehouse, Reports (Excel на сервере), Audit, биллинг.
Тестовый и демонстрационный код во frontend помечен «Демо-данные» и не должен выдаваться за реальную интеграцию.

## Принципы

- Tenant, пришедший от клиента, не является авторизацией: см. `app/dependencies/organization.py`.
- Один клиент — одна граница изоляции: API, фоновые задачи, поиск, выгрузки.
- Деньги — decimal; отсутствующие значения не заменяются нулём.
- Исправлено при смене проекта: колонки `created_at`/`updated_at` в `BaseModel` теперь `timezone=True`
  (раньше любая вставка в БД падала на asyncpg).

## Развёртывание (docker compose)

Один `docker-compose.yml`: `nginx-proxy-manager`, `frontend` (nginx со SPA, `/api` проксируется в `api`), `api`, `migrate`
(`alembic upgrade head`, одноразово), `temporal`, `temporal-worker`, `postgres`, `npm-setup`.
Сети: `edge` (NPM, frontend, api) и `backend` (api, worker, migrate, temporal, postgres). Наружу публикует порты только NPM
(80/443; админка :81 на 127.0.0.1). `npm-setup` по `APP_DOMAIN` / `API_DOMAIN` создаёт или обновляет proxy hosts через API NPM
(идемпотентно), при `NPM_LETSENCRYPT_EMAIL` запрашивает сертификаты. Переменные — в `.env.example`.
Без TLS (локально) задайте `AUTH_COOKIE_SECURE=false`.
