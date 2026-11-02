# Repository Guidelines

## Product

Tech Adviser: AI-платформа бизнес-аналитики для МСП на данных 1С. Источник требований — `docs/PROJECT_BUSINESS_ANALYSIS_BRIEF_RU.md`; архитектура и статус — `ARCHITECTURE.md`, `docs/FRONTEND_STATUS.md`. Не называть продукт иначе и не выдавать демо/планируемые интеграции за работающие.

## Frontend

`frontend/` — React 19 + TypeScript + Vite + Tailwind 4 (npm, один `package-lock.json`). Правила: `FRONTEND_ARCHITECTURE.md`, `FRONTEND_DESIGN_SYSTEM.md`, `FRONTEND_AGENTS.md`. Команды из `frontend/`: `npm ci`, `npm run dev`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`. Название бренда — только в `frontend/src/config/brand.ts`; демо-данные — только в `frontend/src/mocks/` с меткой «Демо-данные».

## Project Structure & Module Organization

`app/` contains the FastAPI service package, and root `app.py` defines and starts the application; `temporal_entry.py` starts the worker; `cmd/` contains process launchers for the API and Temporal worker. `app/routers/` defines public and admin endpoints; `app/schemas/` holds API schemas; and `app/config/`, `app/data_layer/`, `app/middleware/`, `app/resources/`, `app/services/`, and `app/utils/` contain supporting code. SQLAlchemy connection/session setup lives in `app/data_layer/alchemy/api_db.py`, shared ORM models in `app/data_layer/alchemy/models/`, and Alembic migrations in `app/data_layer/alchemy/migrations/`. Temporal workflow definitions belong in `app/temporal/workflows/`; activities and workers belong in `app/temporal/`. PostgreSQL and a Temporal development server are available in Compose; API persistence is being moved from in-memory storage. Backend tests live in `tests/`; frontend tests sit next to the code (`*.test.ts(x)`).

## Build, Test, and Development Commands

Use Python 3.14 and `uv` for dependency management. Run `uv sync --locked` to install the locked environment, then `uv run bash cmd/run_app.sh` to serve locally. Start the Temporal worker with `uv run bash cmd/run_worker.sh`. Browse `/docs` for Swagger UI and `/health` for the health endpoint. Run `docker compose up --build` for the API, PostgreSQL, Temporal development server, and worker; `docker compose up -d --wait postgres` starts only the database. Add or remove dependencies with `uv add <package>` and `uv remove <package>`, and commit corresponding `pyproject.toml` and `uv.lock` changes together.

## Coding Style & Naming Conventions

Follow standard Python style: four-space indentation, `snake_case` for modules, functions, and variables, and `PascalCase` for classes and Pydantic models. Keep routers grouped by domain under `app/routers/`, with admin endpoints under `app/routers/admin/`. Use typed function signatures and explicit Pydantic request/response models for API contracts. Ruff is configured in `pyproject.toml`; run `uv run ruff check .` before submitting changes.

## Testing Guidelines

Run `uv sync --locked --all-groups` first so `pytest` is installed. For new behavior, add focused `pytest` tests under `tests/`, using `test_*.py` filenames and descriptive `test_<behavior>` functions. Exercise API routes through FastAPI's test client and cover success and error responses. Run tests with `uv run pytest` after adding the test dependency and suite.

## Commit & Pull Request Guidelines

Recent commits use short imperative subjects, often with a Conventional Commit type and optional scope, for example `build: add PostgreSQL 18 to Docker Compose` and `feat(dat_layer, resources, schemas, utils): init`. Follow that pattern and keep each commit focused. Pull requests should explain the behavior change, link a related issue when applicable, list validation performed, and include request/response examples or screenshots for API-visible changes.

## Security & Configuration

Copy `.env.example` to `.env` for local secrets and database settings; never commit real credentials. Treat `POSTGRES_*` values as initialization settings for a fresh database volume. Avoid `docker compose down -v` unless deleting local database data is intentional.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
