// DEMO DATA ONLY. Neutral sample company; not real customer results. Every screen that imports
// this module must render <DemoBadge/>. Deterministic (no Math.random) so tests are stable.
import type { PeriodKey } from '../stores/ui'

export const DEMO_COMPANY = 'Демо-компания (пример)'
export const DEMO_AS_OF = new Date('2026-11-02T06:00:00Z')

const MONTH_NAMES = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']
/** 12 complete months: ноя 2025 … окт 2026 */
export const MONTHS = Array.from({ length: 12 }, (_, i) => {
  const m = (10 + i) % 12
  const y = 2025 + Math.floor((10 + i) / 12)
  return { label: `${MONTH_NAMES[m]} ${String(y).slice(2)}`, month: m, year: y }
})

export const PERIODS: { key: PeriodKey; label: string; months: number; long: string }[] = [
  { key: 'M1', label: 'Октябрь 2026', months: 1, long: 'октябрь 2026' },
  { key: 'Q1', label: 'Авг – окт 2026', months: 3, long: 'август – октябрь 2026' },
  { key: 'M6', label: '6 месяцев', months: 6, long: 'май – октябрь 2026' },
  { key: 'M12', label: '12 месяцев', months: 12, long: 'ноябрь 2025 – октябрь 2026' },
]
export const periodMeta = (k: PeriodKey) => PERIODS.find((p) => p.key === k)!

/** current / previous index ranges into MONTHS (previous is null when history is not enough) */
export function ranges(k: PeriodKey) {
  const n = periodMeta(k).months
  const cur: [number, number] = [12 - n, 12]
  const prev: [number, number] | null = 12 - 2 * n >= 0 ? [12 - 2 * n, 12 - n] : null
  return { cur, prev, n }
}

const wave = (i: number, seed: number) => Math.sin(i * 0.9 + seed) * 0.5 + Math.sin(i * 0.37 + seed * 2) * 0.5
const season = (month: number) => 1 + 0.12 * Math.sin(((month - 8) / 12) * Math.PI * 2)

export interface Group { id: string; name: string; base: number; margin: number; marginTrend: number; stock: number; turnover: number; seed: number }
export const GROUPS: Group[] = [
  { id: 'g1', name: 'Электроника', base: 31.0, margin: 0.17, marginTrend: -0.004, stock: 41, turnover: 6.1, seed: 1 },
  { id: 'g2', name: 'Бытовая техника', base: 26.0, margin: 0.21, marginTrend: 0.001, stock: 52, turnover: 4.6, seed: 2 },
  { id: 'g3', name: 'Товары для дома', base: 17.5, margin: 0.33, marginTrend: 0.002, stock: 23, turnover: 5.2, seed: 3 },
  { id: 'g4', name: 'Спорт и отдых', base: 12.8, margin: 0.29, marginTrend: 0.0, stock: 19, turnover: 3.4, seed: 4 },
  { id: 'g5', name: 'Инструменты', base: 14.2, margin: 0.26, marginTrend: 0.003, stock: 27, turnover: 4.0, seed: 5 },
  { id: 'g6', name: 'Автотовары', base: 9.6, margin: 0.24, marginTrend: -0.002, stock: 16, turnover: 3.0, seed: 6 },
  { id: 'g7', name: 'Сад и огород', base: 7.4, margin: 0.36, marginTrend: 0.0, stock: 14, turnover: 2.3, seed: 7 },
  { id: 'g8', name: 'Канцелярия', base: 5.1, margin: 0.31, marginTrend: 0.001, stock: 6, turnover: 7.4, seed: 8 },
]

/** revenue, млн ₽ per month per group */
const revenue: Record<string, number[]> = Object.fromEntries(
  GROUPS.map((g) => [g.id, MONTHS.map((m, i) => +(g.base * season(m.month) * (1 + 0.012 * i + 0.06 * wave(i, g.seed))).toFixed(3))]),
)
const marginAt = (g: Group, i: number) => g.margin + g.marginTrend * (i - 6) + 0.006 * wave(i, g.seed + 3)

const sum = (a: number[]) => a.reduce((x, y) => x + y, 0)
const slice = <T,>(a: T[], r: [number, number]) => a.slice(r[0], r[1])

export interface Agg { revenue: number; cogs: number; gross: number; margin: number }
function aggGroup(g: Group, r: [number, number]): Agg {
  let rev = 0, gross = 0
  for (let i = r[0]; i < r[1]; i++) { rev += revenue[g.id][i]; gross += revenue[g.id][i] * marginAt(g, i) }
  return { revenue: rev, cogs: rev - gross, gross, margin: rev ? gross / rev : 0 }
}
const addAgg = (a: Agg, b: Agg): Agg => {
  const rev = a.revenue + b.revenue, gross = a.gross + b.gross
  return { revenue: rev, cogs: rev - gross, gross, margin: rev ? gross / rev : 0 }
}
export const totalAgg = (r: [number, number]): Agg => GROUPS.map((g) => aggGroup(g, r)).reduce(addAgg)
const pct = (cur: number, prev: number | undefined) => (prev === undefined || prev === 0 ? null : ((cur - prev) / Math.abs(prev)) * 100)

// ---- warehouses & inventory ----------------------------------------------------------------
export const WAREHOUSES = [
  { id: 'w1', name: 'Центральный склад', city: 'Москва', share: 0.46 },
  { id: 'w2', name: 'Склад «Север»', city: 'Санкт-Петербург', share: 0.24 },
  { id: 'w3', name: 'Склад «Юг»', city: 'Краснодар', share: 0.2 },
  { id: 'w4', name: 'Магазин-склад', city: 'Казань', share: 0.1 },
]

const stockNow = (g: Group) => g.stock * 1.0 // млн ₽ at end of period (demo constant)
export const inventoryTotal = () => sum(GROUPS.map(stockNow))

export interface StockItem { sku: string; name: string; group: string; warehouse: string; value: number; daysNoSales: number; qty: number }
const ITEM_NAMES = ['Смартфон X-12', 'Ноутбук 15"', 'Наушники BT', 'Робот-пылесос', 'Микроволновая печь', 'Кофемашина', 'Набор посуды', 'Беговая дорожка', 'Палатка 4-местная', 'Шуруповёрт 18В', 'Перфоратор', 'Видеорегистратор', 'Автокомпрессор', 'Газонокосилка', 'Теплица 3 м', 'Принтер лазерный', 'Телевизор 50"', 'Холодильник', 'Стиральная машина', 'Пылесос', 'Матрас ортопед.', 'Велосипед горный', 'Гантели набор', 'Набор отвёрток', 'Шины зимние', 'Триммер', 'Бумага А4 (пал.)', 'Планшет 10"', 'Умная колонка', 'Утюг паровой']
export const STOCK_ITEMS: StockItem[] = ITEM_NAMES.map((name, i) => {
  const g = GROUPS[(i * 3 + (i % 5)) % GROUPS.length]
  const w = WAREHOUSES[(i * 7) % WAREHOUSES.length]
  const value = Math.round((0.18 + ((i * 37) % 23) / 10) * 1_000_000) / 1
  return { sku: `A-${1000 + i * 13}`, name, group: g.name, warehouse: w.name, value, daysNoSales: 35 + ((i * 29) % 190), qty: 8 + ((i * 17) % 140) }
})

export interface StockRisk { sku: string; name: string; group: string; coverDays: number; leadDays: number }
export const SHORTAGE_RISKS: StockRisk[] = [
  { sku: 'A-1026', name: 'Видеорегистратор', group: 'Автотовары', coverDays: 9, leadDays: 21 },
  { sku: 'A-1065', name: 'Смартфон X-12', group: 'Электроника', coverDays: 12, leadDays: 14 },
  { sku: 'A-1104', name: 'Шуруповёрт 18В', group: 'Инструменты', coverDays: 15, leadDays: 18 },
  { sku: 'A-1143', name: 'Наушники BT', group: 'Электроника', coverDays: 17, leadDays: 12 },
]

// ---- logistics --------------------------------------------------------------------------------
const logisticsMonthly = MONTHS.map((m, i) => +(2.15 * season(m.month) * (1 + 0.02 * i + 0.05 * wave(i, 11))).toFixed(3)) // млн ₽
export interface Carrier { id: string; name: string; shipments: number; cost: number; onTimeShare: number | null; avgDays: number | null }
export const CARRIERS: Carrier[] = [
  { id: 'c1', name: 'ТК «Меридиан»', shipments: 4120, cost: 5.1, onTimeShare: 0.93, avgDays: 2.4 },
  { id: 'c2', name: 'Перевозчик «Вектор»', shipments: 3350, cost: 4.4, onTimeShare: 0.88, avgDays: 3.1 },
  { id: 'c3', name: 'ТК «Север-Транс»', shipments: 1980, cost: 3.9, onTimeShare: 0.81, avgDays: 4.6 },
  { id: 'c4', name: 'Курьерская служба «Дельта»', shipments: 5240, cost: 3.2, onTimeShare: 0.96, avgDays: 1.2 },
  { id: 'c5', name: 'Собственный автопарк', shipments: 1270, cost: 2.6, onTimeShare: null, avgDays: null }, // нет отметок доставки
]

// ---- aggregations used by pages ---------------------------------------------------------------
export function dashboard(k: PeriodKey) {
  const { cur, prev, n } = ranges(k)
  const a = totalAgg(cur)
  const p = prev ? totalAgg(prev) : null
  const log = sum(slice(logisticsMonthly, cur))
  const logPrev = prev ? sum(slice(logisticsMonthly, prev)) : undefined
  const trendFrom = Math.max(0, cur[1] - Math.max(n, 6))
  const trend = MONTHS.slice(trendFrom, cur[1]).map((m, j) => {
    const i = trendFrom + j
    const t = totalAgg([i, i + 1])
    return { month: m.label, revenue: +t.revenue.toFixed(2), gross: +t.gross.toFixed(2), margin: +(t.margin * 100).toFixed(1) }
  })
  return {
    revenue: { value: a.revenue, delta: pct(a.revenue, p?.revenue) },
    gross: { value: a.gross, delta: pct(a.gross, p?.gross) },
    margin: { value: a.margin * 100, delta: p ? (a.margin - p.margin) * 100 : null }, // п.п.
    inventory: { value: inventoryTotal(), delta: 2.8 },
    logistics: { value: log, delta: pct(log, logPrev) },
    trend,
    byGroup: GROUPS.map((g) => ({ name: g.name, revenue: +aggGroup(g, cur).revenue.toFixed(1) })).sort((x, y) => y.revenue - x.revenue),
    byWarehouse: WAREHOUSES.map((w) => ({ name: w.name, value: +(inventoryTotal() * w.share).toFixed(1) })),
  }
}

export interface GroupRow { id: string; name: string; revenue: number; cogs: number; gross: number; margin: number; marginDelta: number | null; stock: number; turnover: number; revenueShare: number; grossShare: number }
export function groupRows(k: PeriodKey): GroupRow[] {
  const { cur, prev } = ranges(k)
  const total = totalAgg(cur)
  return GROUPS.map((g) => {
    const a = aggGroup(g, cur)
    const p = prev ? aggGroup(g, prev) : null
    return { id: g.id, name: g.name, ...a, marginDelta: p ? (a.margin - p.margin) * 100 : null, stock: stockNow(g), turnover: g.turnover, revenueShare: a.revenue / total.revenue, grossShare: a.gross / total.gross }
  })
}
export function groupTrend(id: string) {
  const g = GROUPS.find((x) => x.id === id)!
  return MONTHS.map((m, i) => ({ month: m.label, revenue: +revenue[id][i].toFixed(2), margin: +(marginAt(g, i) * 100).toFixed(1) }))
}

export function logisticsView(k: PeriodKey) {
  const { cur, prev } = ranges(k)
  const cost = sum(slice(logisticsMonthly, cur))
  const rev = totalAgg(cur).revenue
  const costPrev = prev ? sum(slice(logisticsMonthly, prev)) : undefined
  const share = ranges(k).n
  const scale = share / 12
  return {
    cost, delta: pct(cost, costPrev), shareOfRevenue: (cost / rev) * 100,
    trend: MONTHS.map((m, i) => ({ month: m.label, cost: logisticsMonthly[i], inPeriod: i >= cur[0] })),
    carriers: CARRIERS.map((c) => ({ ...c, shipments: Math.round(c.shipments * scale), cost: +(c.cost * scale).toFixed(2), costPerShipment: Math.round(((c.cost * 1e6) / c.shipments)) })),
    byGroup: GROUPS.map((g, i) => ({ name: g.name, cost: +(cost * [0.2, 0.23, 0.14, 0.12, 0.1, 0.08, 0.09, 0.04][i]).toFixed(2) })),
  }
}

// ---- financial statements ---------------------------------------------------------------------
export interface StatementLine { id: string; label: string; account: string; current: number; previous: number | null; bold?: boolean; hint: string }
export function incomeStatement(k: PeriodKey): StatementLine[] {
  const { cur, prev } = ranges(k)
  const f = (r: [number, number]) => {
    const a = totalAgg(r)
    const log = sum(slice(logisticsMonthly, r))
    const commercial = a.revenue * 0.062 + log
    const admin = a.revenue * 0.048
    const sales = a.gross - commercial - admin
    const other = a.revenue * -0.004
    const pbt = sales + other
    const tax = Math.max(0, pbt * 0.2)
    return { rev: a.revenue, cogs: a.cogs, gross: a.gross, commercial, admin, sales, other, pbt, tax, net: pbt - tax }
  }
  const c = f(cur), p = prev ? f(prev) : null
  const L = (id: string, label: string, account: string, key: keyof typeof c, hint: string, bold = false, sign = 1): StatementLine => ({ id, label, account, current: c[key] * sign, previous: p ? p[key] * sign : null, bold, hint })
  return [
    L('rev', 'Выручка', '90.01', 'rev', 'Доходы от продажи товаров за вычетом НДС.', true),
    L('cogs', 'Себестоимость продаж', '90.02', 'cogs', 'Покупная стоимость проданных товаров.', false, -1),
    L('gross', 'Валовая прибыль', '90.09', 'gross', 'Выручка минус себестоимость продаж.', true),
    L('commercial', 'Коммерческие расходы', '44', 'commercial', 'Включают расходы на доставку и логистику.', false, -1),
    L('admin', 'Управленческие расходы', '26', 'admin', 'Общехозяйственные расходы.', false, -1),
    L('sales', 'Прибыль от продаж', '90.09', 'sales', 'Валовая прибыль минус коммерческие и управленческие расходы.', true),
    L('other', 'Прочие доходы и расходы', '91', 'other', 'Сальдо прочих доходов и расходов.'),
    L('pbt', 'Прибыль до налогообложения', '99', 'pbt', 'Прибыль от продаж с учётом прочих доходов и расходов.', true),
    L('tax', 'Налог на прибыль', '68.04', 'tax', 'Ставка 20% принята для демонстрации.', false, -1),
    L('net', 'Чистая прибыль', '99', 'net', 'Итоговый финансовый результат периода.', true),
  ]
}

export function balanceSheet(k: PeriodKey): StatementLine[] {
  const { n } = ranges(k)
  const inv = inventoryTotal()
  const growth = (cur: number, rate: number) => ({ cur, prev: cur / (1 + rate * Math.min(n, 6) / 6) })
  const fixed = growth(68, 0.015), stock = growth(inv, 0.028), recv = growth(46, 0.034), cash = growth(37, -0.02)
  const loans = growth(54, -0.01), payables = growth(61, 0.025)
  const assets = (key: 'cur' | 'prev') => fixed[key] + stock[key] + recv[key] + cash[key]
  const equity = (key: 'cur' | 'prev') => assets(key) - loans[key] - payables[key]
  const line = (id: string, label: string, account: string, v: { cur: number; prev: number }, hint: string, bold = false): StatementLine => ({ id, label, account, current: v.cur, previous: k === 'M12' ? null : v.prev, bold, hint })
  const tot = (cur: number, prev: number) => ({ cur, prev })
  return [
    line('fixed', 'Основные средства', '01', fixed, 'Остаточная стоимость основных средств.'),
    line('stock', 'Запасы', '41', stock, 'Товары на складах по учётной стоимости.'),
    line('recv', 'Дебиторская задолженность', '62', recv, 'Задолженность покупателей.'),
    line('cash', 'Денежные средства', '51', cash, 'Остатки на расчётных счетах.'),
    line('assets', 'АКТИВЫ', '', tot(assets('cur'), assets('prev')), 'Сумма активов.', true),
    line('equity', 'Капитал и резервы', '80', tot(equity('cur'), equity('prev')), 'Рассчитан как разница активов и обязательств (демо).'),
    line('loans', 'Заёмные средства', '67', loans, 'Кредиты и займы.'),
    line('payables', 'Кредиторская задолженность', '60', payables, 'Задолженность поставщикам.'),
    line('liab', 'ПАССИВЫ', '', tot(assets('cur'), assets('prev')), 'Сумма пассивов; равна активам.', true),
  ]
}

export function cashFlow(k: PeriodKey): StatementLine[] {
  const { cur, prev } = ranges(k)
  const f = (r: [number, number]) => {
    const a = totalAgg(r)
    const inflow = a.revenue * 0.97
    const suppliers = -a.cogs * 0.95
    const logistic = -sum(slice(logisticsMonthly, r))
    const payroll = -a.revenue * 0.075
    const taxes = -a.revenue * 0.03
    return { inflow, suppliers, logistic, payroll, taxes, net: inflow + suppliers + logistic + payroll + taxes }
  }
  const c = f(cur), p = prev ? f(prev) : null
  const L = (id: string, label: string, account: string, key: keyof typeof c, hint: string, bold = false): StatementLine => ({ id, label, account, current: c[key], previous: p ? p[key] : null, bold, hint })
  return [
    L('inflow', 'Поступления от покупателей', '51', 'inflow', 'Оплаты от покупателей за период.'),
    L('suppliers', 'Платежи поставщикам', '60', 'suppliers', 'Оплата поставщикам товаров.'),
    L('logistic', 'Платежи за логистику', '60', 'logistic', 'Расходы на доставку.'),
    L('payroll', 'Оплата труда', '70', 'payroll', 'Выплаты персоналу.'),
    L('taxes', 'Налоги и взносы', '68', 'taxes', 'Налоговые платежи.'),
    L('net', 'Чистый денежный поток', '', 'net', 'Сумма потоков за период.', true),
  ]
}

export interface DrillRow { doc: string; date: string; correspondence: string; amount: number }
export function accountDrill(account: string, current: number): DrillRow[] {
  const parts = [0.38, 0.27, 0.21, 0.14]
  const docs = ['Реализация товаров', 'Поступление товаров', 'Корректировка', 'Поступление на счёт']
  return parts.map((s, i) => ({ doc: `${docs[i]} №${(4100 + i * 137).toString()}`, date: `2026-10-${String(24 - i * 5).padStart(2, '0')}`, correspondence: i % 2 ? `Дт ${account || '99'} / Кт 60` : `Дт 62 / Кт ${account || '90'}`, amount: current * s }))
}

export const MAPPING = { version: 'rsbu-map-2026.10-demo', accounts: 11, mapped: 9, missing: ['Субсчёт 44.03 «Транспортные расходы» (не сопоставлен)', 'Аналитика по статье 91.02'] }

// ---- integrations / infra / reports ----------------------------------------------------------
export interface DemoSyncRun { id: string; mode: 'FULL' | 'INCREMENTAL' | 'RECONCILIATION' | 'RECOVERY'; status: 'SUCCEEDED' | 'FAILED' | 'RUNNING'; startedAt: string; durationSec: number; received: number; accepted: number; rejected: number; quarantined: number; note: string | null }
export const SYNC_HISTORY: DemoSyncRun[] = [
  { id: 's9', mode: 'INCREMENTAL', status: 'SUCCEEDED', startedAt: '2026-11-02T05:00:00Z', durationSec: 94, received: 1840, accepted: 1832, rejected: 3, quarantined: 5, note: null },
  { id: 's8', mode: 'INCREMENTAL', status: 'SUCCEEDED', startedAt: '2026-11-02T01:00:00Z', durationSec: 71, received: 960, accepted: 960, rejected: 0, quarantined: 0, note: null },
  { id: 's7', mode: 'RECONCILIATION', status: 'SUCCEEDED', startedAt: '2026-11-01T22:00:00Z', durationSec: 312, received: 0, accepted: 0, rejected: 0, quarantined: 0, note: 'Расхождение остатков по складу «Юг»: 0,3% (в пределах допуска).' },
  { id: 's6', mode: 'INCREMENTAL', status: 'FAILED', startedAt: '2026-11-01T17:00:00Z', durationSec: 12, received: 0, accepted: 0, rejected: 0, quarantined: 0, note: 'Нет связи с агентом. Проверьте, что служба агента запущена и есть исходящий доступ в интернет.' },
  { id: 's5', mode: 'RECOVERY', status: 'SUCCEEDED', startedAt: '2026-10-31T09:00:00Z', durationSec: 205, received: 5210, accepted: 5198, rejected: 12, quarantined: 0, note: 'Повторная обработка пакетов за 29–30 октября.' },
  { id: 's4', mode: 'FULL', status: 'SUCCEEDED', startedAt: '2026-10-28T03:00:00Z', durationSec: 2860, received: 1_284_300, accepted: 1_281_900, rejected: 1_240, quarantined: 1_160, note: 'Первичная загрузка за 24 месяца.' },
]
export const SYNC_ENTITIES = [
  { name: 'Номенклатура и группы', state: 'supported' }, { name: 'Склады и остатки', state: 'supported' },
  { name: 'Реализации и закупки', state: 'supported' }, { name: 'Проводки и обороты счетов', state: 'partial' },
  { name: 'Логистические события (отметки доставки)', state: 'unsupported' },
] as const

export const QUALITY_CHECKS: { label: string; status: 'VALIDATED' | 'PARTIALLY_VALIDATED' | 'REQUIRES_ATTENTION' | 'FAILED'; detail: string }[] = [
  { label: 'Продажи и себестоимость', status: 'VALIDATED', detail: 'Сверка с оборотами счёта 90: расхождение 0,02%.' },
  { label: 'Складские остатки', status: 'PARTIALLY_VALIDATED', detail: 'Склад «Юг»: сверка выполнена на 1 ноября, есть расхождение 0,3%.' },
  { label: 'Логистика', status: 'REQUIRES_ATTENTION', detail: 'У собственного автопарка нет отметок доставки — время доставки не рассчитывается.' },
  { label: 'Финансовая отчётность', status: 'PARTIALLY_VALIDATED', detail: 'Не сопоставлены 2 из 11 счетов; отчёт показан с ограничениями.' },
]

export const INFRA = {
  status: 'Работает', version: 'PostgreSQL 18', region: 'RU (демо)', provisionedAt: '2026-10-27T08:12:00Z',
  disk: { usedGb: 18.4, limitGb: 50 }, lastLoadAt: '2026-11-02T05:01:34Z', backup: { state: 'настроено', lastAt: '2026-11-02T02:00:00Z' },
  layers: [
    { name: 'Raw', desc: 'Исходные записи и сведения о происхождении', rows: 2_410_000, updated: '2026-11-02T05:01:00Z' },
    { name: 'Staging', desc: 'Проверка и нормализация', rows: 2_395_000, updated: '2026-11-02T05:01:20Z' },
    { name: 'Core', desc: 'Канонические бизнес-сущности', rows: 1_870_000, updated: '2026-11-02T05:01:30Z' },
    { name: 'Marts', desc: 'Витрины для аналитики', rows: 96_000, updated: '2026-11-02T05:01:34Z' },
  ],
  connection: { host: '••••••••.db.techadviser.example', port: '5432', database: '••••••••', user: '••••••••', password: '••••••••••••' },
}

export type ReportKind = 'executive' | 'product' | 'inventory' | 'logistics' | 'financial'
export const REPORT_KINDS: { id: ReportKind; label: string; sheets: string[] }[] = [
  { id: 'executive', label: 'Резюме для собственника', sheets: ['Резюме', 'Расчёты', 'Аналитика', 'Рекомендации AI', 'Допущения и ограничения', 'Методология'] },
  { id: 'product', label: 'Товарные группы', sheets: ['Резюме', 'Исходные данные', 'Расчёты', 'Аналитика', 'Методология'] },
  { id: 'inventory', label: 'Запасы и склады', sheets: ['Резюме', 'Исходные данные', 'Расчёты', 'Аналитика', 'Допущения и ограничения'] },
  { id: 'logistics', label: 'Логистика', sheets: ['Резюме', 'Расчёты', 'Аналитика', 'Допущения и ограничения'] },
  { id: 'financial', label: 'Финансовая отчётность (ориентирована на РСБУ)', sheets: ['Резюме', 'Баланс', 'Финансовые результаты', 'Денежные потоки', 'Допущения и ограничения', 'Методология'] },
]
