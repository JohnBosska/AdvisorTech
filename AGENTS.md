# Repository Guidelines

## Project Structure & Module Organization

`app/` contains the FastAPI service. `app/main.py` creates the application; `app/routers/` defines public and admin endpoints; `app/schemas/` holds request and response models; and `app/config/`, `app/data_layer/`, `app/resources/`, and `app/utils/` contain configuration and supporting code. `app/schemas.py` is the current consolidated schema module. `migrations/` is reserved for database migrations; PostgreSQL is available in Compose, but API persistence is currently in memory. There is no checked-in test or asset directory yet.

## Build, Test, and Development Commands

Use Python 3.14 and `uv` for dependency management. Run `uv sync --locked` to install the locked environment, then `uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000` to serve locally. Browse `/docs` for Swagger UI and `/health` for the health endpoint. Run `docker compose up --build` for the API and PostgreSQL stack; `docker compose up -d --wait postgres` starts only the database. Add or remove dependencies with `uv add <package>` and `uv remove <package>`, and commit corresponding `pyproject.toml` and `uv.lock` changes together.

## Coding Style & Naming Conventions

Follow standard Python style: four-space indentation, `snake_case` for modules, functions, and variables, and `PascalCase` for classes and Pydantic models. Keep routers grouped by domain under `app/routers/`, with admin endpoints under `app/routers/admin/`. Use typed function signatures and explicit Pydantic request/response models for API contracts. No formatter or linter configuration is currently checked in; keep changes consistent with nearby code.

## Testing Guidelines

No test suite or test runner configuration is present yet. For new behavior, add focused `pytest` tests under `tests/`, using `test_*.py` filenames and descriptive `test_<behavior>` functions. Exercise API routes through FastAPI's test client and cover success and error responses. Run tests with `uv run pytest` after adding the test dependency and suite.

## Commit & Pull Request Guidelines

Recent commits use short imperative subjects, often with a Conventional Commit type and optional scope, for example `build: add PostgreSQL 18 to Docker Compose` and `feat(dat_layer, resources, schemas, utils): init`. Follow that pattern and keep each commit focused. Pull requests should explain the behavior change, link a related issue when applicable, list validation performed, and include request/response examples or screenshots for API-visible changes.

## Security & Configuration

Copy `.env.example` to `.env` for local secrets and database settings; never commit real credentials. Treat `POSTGRES_*` values as initialization settings for a fresh database volume. Avoid `docker compose down -v` unless deleting local database data is intentional.
