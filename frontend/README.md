# Tech Adviser — frontend

React 19 + TypeScript (strict) + Vite + Tailwind CSS 4 · React Router 7 · TanStack Query/Table · Zustand · React Hook Form + Zod ·
Motion · Recharts · Three.js + React Three Fiber (только лендинг, загружается лениво). Интерфейс на русском, код на английском.

```bash
npm ci
cp .env.example .env        # необязательно
npm run dev                 # http://localhost:5173, /api -> http://localhost:8000
npm run lint && npm run typecheck && npm test && npm run build
```

Бэкенд для входа: `uv run bash cmd/run_app.sh` из корня репозитория (нужен PostgreSQL и `AUTH_JWT_SECRET`).

Структура — по [FRONTEND_ARCHITECTURE.md](../FRONTEND_ARCHITECTURE.md) §6; статус, что реально, что демо и что нужно от backend — в
[docs/FRONTEND_STATUS.md](../docs/FRONTEND_STATUS.md). Название продукта — `src/config/brand.ts`; демо-данные — `src/mocks/`.
