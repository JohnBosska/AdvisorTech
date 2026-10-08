FROM python:3.14-slim

COPY --from=ghcr.io/astral-sh/uv:0.12.18 /uv /uvx /bin/

WORKDIR /app

ENV UV_PYTHON_DOWNLOADS=never \
    PATH="/app/.venv/bin:$PATH"

COPY pyproject.toml uv.lock ./
RUN uv sync --locked --no-dev --no-cache

COPY app ./app
COPY cmd ./cmd
COPY app.py temporal_entry.py alembic.ini ./

EXPOSE 8000

CMD ["bash", "cmd/run_app.sh"]
