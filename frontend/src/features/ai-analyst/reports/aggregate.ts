import type { Aggregation, DatasetColumn, Row, Widget } from '../../../lib/api/reports'

export interface Point { label: string; value: number }
export const OTHER = 'Другое'

/** Deterministic aggregation in the browser: the model plans, it never computes numbers. */
export function reduce(values: number[], agg: Aggregation): number {
  if (agg === 'count') return values.length
  if (values.length === 0) return 0
  if (agg === 'sum') return values.reduce((a, b) => a + b, 0)
  if (agg === 'avg') return values.reduce((a, b) => a + b, 0) / values.length
  if (agg === 'min') return Math.min(...values)
  return Math.max(...values)
}

const num = (v: Row[string]) => (typeof v === 'number' && Number.isFinite(v) ? v : null)

/** dd.mm.yyyy → yyyy-mm-dd so dates sort chronologically. */
export function dateKey(v: string): string {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})/.exec(v)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : v
}

export function kpi(rows: Row[], w: Widget): number {
  const values = w.agg === 'count' && !w.y ? rows.map(() => 1) : rows.map((r) => num(r[w.y!])).filter((v): v is number => v !== null)
  return reduce(values, w.agg)
}

export function group(rows: Row[], w: Widget, columns: DatasetColumn[]): Point[] {
  if (!w.x) return []
  const isDate = columns.find((c) => c.name === w.x)?.type === 'date'
  const buckets = new Map<string, number[]>()
  for (const r of rows) {
    const raw = r[w.x]
    if (raw === null || raw === undefined || raw === '') continue
    const key = isDate ? dateKey(String(raw)) : String(raw)
    const value = w.y ? num(r[w.y]) : 1
    if (value === null && w.agg !== 'count') continue
    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key)!.push(value ?? 1)
  }
  let points = [...buckets].map(([label, values]) => ({ label, value: reduce(values, w.agg) }))
  if (isDate || w.type === 'line') return points.sort((a, b) => a.label.localeCompare(b.label)).slice(-Math.max(w.limit, 2) * 4)
  points = points.sort((a, b) => b.value - a.value)
  if (points.length > w.limit && (w.type === 'pie' || w.type === 'bar') && (w.agg === 'sum' || w.agg === 'count')) {
    const rest = points.slice(w.limit - 1).reduce((a, p) => a + p.value, 0)
    return [...points.slice(0, w.limit - 1), { label: OTHER, value: rest }]
  }
  return points.slice(0, w.limit)
}

/** Same rules as the server-side validator, for widgets the user adds by hand. */
export function widgetError(w: Widget, columns: DatasetColumn[]): string | null {
  const type = (name: string | null) => columns.find((c) => c.name === name)?.type
  if (w.y && type(w.y) !== 'number') return 'Мера должна быть числовой колонкой'
  if (!w.y && w.agg !== 'count') return 'Выберите числовую колонку или «количество»'
  if (w.type === 'kpi') return null
  if (!w.x || !type(w.x)) return 'Выберите колонку для группировки'
  if (w.type === 'line' && type(w.x) !== 'date') return 'Для линии нужна колонка с датой'
  return null
}

const fmt = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 })
const compact = new Intl.NumberFormat('ru-RU', { notation: 'compact', maximumFractionDigits: 1 })
export const formatNumber = (v: number) => fmt.format(v)
export const formatCompact = (v: number) => (Math.abs(v) >= 10000 ? compact.format(v) : fmt.format(v))

export function toCsv(sections: { title: string; points: Point[] }[]): string {
  const esc = (s: string) => (/[";\n]/.test(s) || /^[=+\-@]/.test(s) ? `"${s.replace(/^([=+\-@])/, "'$1").replace(/"/g, '""')}"` : s)
  return sections.map((s) => [esc(s.title), ...s.points.map((p) => `${esc(p.label)};${String(p.value).replace('.', ',')}`)].join('\n')).join('\n\n')
}
