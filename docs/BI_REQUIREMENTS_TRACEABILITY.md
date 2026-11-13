# Матрица покрытия требований BI-платформы

Статусы: NOT STARTED · IN PROGRESS · IMPLEMENTED (код и миграции есть) · TESTED (есть автотесты) · VERIFIED (проверено на проде вручную или сквозным прогоном).

| № | Требование (модуль задания) | Статус | Где в коде | Примечание |
|---|---|---|---|---|
| 1.1 | Мультитенантность, организации, участники, приглашения | VERIFIED | `app/resources/organization.py`, `member.py` | Роли: OWNER, FINANCE, ANALYST, IT_ADMIN |
| 1.2 | Кастомные роли, права на объекты, RLS, временный доступ | NOT STARTED | — | Фаза 1.2–2 |
| 1.3 | Аудит действий пользователей и запросов ИИ | TESTED | `audit_events`, `services/audit.py`, `/app/audit` | Инкремент 1.2 |
| 2.1 | Агент-API: токены, heartbeat, запуски, идемпотентные батчи | TESTED | `app/routers/agent.py`, `resources/agent.py` | |
| 2.2 | Хранение записей от агента (сырой слой) | TESTED | `raw_records`, `resources/agent.py`, `resources/warehouse.py` | Инкремент 1.1 |
| 2.3 | Прямые источники: файл, ссылка, 1С OData, PostgreSQL | VERIFIED | `services/bi.py`, `bi_url.py`, `bi_sources.py` | Без хранения, лимит 5000 строк, SSRF-защита |
| 2.4 | MS SQL, MySQL, Oracle, JSON/XML/Parquet, REST/SOAP, ClickHouse… | NOT STARTED | — | Фаза 1.3 |
| 2.5 | Connector Agent для 1С в закрытой сети | NOT STARTED | — | Фаза 1.4 |
| 3 | ETL/ELT, визуальный конструктор | NOT STARTED | — | Фаза 1.3/2 |
| 4.1 | Raw-слой | TESTED | миграция `0008_raw_records` | |
| 4.2 | Staging / core / marts, факты и измерения | NOT STARTED | — | Фаза 2–3 |
| 5 | Семантическая модель, меры, KPI-каталог, движок формул | NOT STARTED | — | Фаза 2 |
| 6.1 | Холст, drag/resize, страницы, формат, темы, undo/redo | TESTED | `frontend/src/features/bi/` | |
| 6.2 | Визуалы: карточка, таблица, матрица, столбцы, линии, области, круговые, точечная, срез, текст | TESTED | `VisualView.tsx` | |
| 6.3 | Heatmap, карта, waterfall, воронка, treemap, Sankey, Гант, box plot, комбинированные | NOT STARTED | — | Фаза 2 |
| 6.4 | Перекрёстная фильтрация, фильтры страницы/отчёта, срезы, сортировка, топ-N | TESTED | `compute.ts`, `Canvas.tsx` | |
| 6.5 | Drill-down/up/through, сравнение периодов, условное форматирование, сохранённые представления | NOT STARTED | — | Фаза 2 |
| 6.6 | Сохранение отчётов, обновление по ссылке/хранилищу | TESTED | `bi_reports`, `resources/bi_reports.py` | |
| 6.7 | Экспорт: CSV визуала, печать/PDF из браузера | IMPLEMENTED | `BiStudio.tsx` | XLSX/PNG на сервере и расписания — NOT STARTED |
| 7 | Финансовая аналитика, РСБУ, бюджеты | NOT STARTED | демо-страница | Фаза 3 |
| 8 | Аналитика продаж | NOT STARTED | демо-страница | Фаза 3 |
| 9 | Запасы, закупки, логистика | NOT STARTED | демо-страницы | Фаза 3 |
| 10 | Прогнозы, аномалии | NOT STARTED | — | Фаза 5 |
| 11 | Сценарии | NOT STARTED | — | Фаза 5 |
| 12.1 | RAG по документам: чанки, FTS + pgvector, RRF, ссылки, проверка ответа, трасса, XLSX | VERIFIED | `resources/knowledge.py`, `chat.py`, `utils/rag.py` | pgvector вместо Qdrant |
| 12.2 | AI-запросы к данным через семантический слой с валидацией | NOT STARTED | этап `sql_analytics` всегда skipped | Фаза 4 |
| 12.3 | Парсинг PDF/DOCX/XLSX, права на документ, переиндексация | NOT STARTED | — | Фаза 4 |
| 13 | Генерация дашборда по тексту | TESTED | `services/bi.py` (план), `BiStudio.planToVisuals` | Правка существующего — NOT STARTED |
| 14 | Специализированные агенты, оркестратор | NOT STARTED | — | Фаза 6 |
| 15 | Health Score, RCA | NOT STARTED | — | Фаза 5 |
| 16 | Алерты, рекомендации | NOT STARTED | — | Фаза 5 |
| 17 | Автоматизация процессов | NOT STARTED | — | Фаза 6 |
| 18 | Коллаборация, Embedded BI | NOT STARTED | — | Фаза 6 |
| 19 | Каталоги, lineage, аудит | IN PROGRESS | аудит-лог есть; каталоги и lineage — Фаза 2 | |
| 20 | Админ-панель, персонализация | NOT STARTED | — | |
| NFR-S | Тенант-изоляция, RBAC, параметризованные запросы, таймауты, READ ONLY, SSRF, prompt-injection в RAG, лимиты частоты | TESTED | везде | RLS/CLS — NOT STARTED |
| NFR-P | Мониторинг запросов, нагрузочные тесты, кэш | NOT STARTED | — | |
| NFR-R | Ретраи, идемпотентность батчей, health-check, структурные логи | IMPLEMENTED | | Бэкапы по расписанию — NOT STARTED |
