import { dateKey, reduce } from '../ai-analyst/reports/aggregate'
import type { Aggregation, CrossFilter, Dataset, Fields, Filter, Format, NumberFormat, Visual } from './types'

type Row = Dataset['rows'][number]
export const BLANK = '(пусто)'

const num = (v: Row[string]) => (typeof v === 'number' && Number.isFinite(v) ? v : null)

export function keyOf(row: Row, column: string, types: Record<string, string>): string {
  const raw = row[column]
  if (raw === null || raw === undefined || raw === '') return BLANK
  return types[column] === 'date' ? dateKey(String(raw)) : String(raw)
}

export function columnTypes(ds: Dataset): Record<string, string> {
  return Object.fromEntries(ds.columns.map((c) => [c.name, c.type]))
}

export function applyFilters(rows: Row[], filters: Filter[], types: Record<string, string>): Row[] {
  const active = filters.filter((f) => f.column && (f.kind === 'values' ? f.values.length > 0 : f.min !== null || f.max !== null))
  if (!active.length) return rows
  return rows.filter((r) => active.every((f) => {
    if (f.kind === 'values') return f.values.includes(keyOf(r, f.column, types))
    const v = types[f.column] === 'date' ? Date.parse(keyOf(r, f.column, types)) : num(r[f.column])
    if (v === null || Number.isNaN(v)) return false
    return (f.min === null || v >= f.min) && (f.max === null || v <= f.max)
  }))
}

/** Filters a visual sees: report + page + slicers on the page + a cross-filter from another visual. */
export function visualFilters(v: Visual, report: Filter[], page: Filter[], slicers: Visual[], cross: CrossFilter | null): Filter[] {
  const out = [...report, ...page]
  for (const s of slicers) if (s.id !== v.id && s.fields.category && s.selected?.length) out.push({ id: s.id, column: s.fields.category, kind: 'values', values: s.selected, min: null, max: null })
  if (cross && cross.visualId !== v.id) out.push({ id: 'cross', column: cross.column, kind: 'values', values: [cross.value], min: null, max: null })
  return out
}

const measure = (rows: Row[], column: string | null, agg: Aggregation) =>
  reduce(agg === 'count' || !column ? rows.map(() => 1) : rows.map((r) => num(r[column])).filter((x): x is number => x !== null), column ? agg : 'count')

export function cardValue(rows: Row[], f: Fields): number { return measure(rows, f.value, f.agg) }

export interface SeriesData { categories: string[]; series: string[]; data: Record<string, string | number>[] }

/** Category × series aggregation with sort and top-N on category totals. */
export function categorySeries(rows: Row[], f: Fields, fmt: Pick<Format, 'sort' | 'topN'>, types: Record<string, string>): SeriesData {
  if (!f.category) return { categories: [], series: [], data: [] }
  const groups = new Map<string, Map<string, Row[]>>()
  const seriesSet = new Set<string>()
  for (const r of rows) {
    const c = keyOf(r, f.category, types)
    const s = f.series ? keyOf(r, f.series, types) : 'value'
    seriesSet.add(s)
    if (!groups.has(c)) groups.set(c, new Map())
    const g = groups.get(c)!
    if (!g.has(s)) g.set(s, [])
    g.get(s)!.push(r)
  }
  const series = [...seriesSet].sort((a, b) => a.localeCompare(b, 'ru'))
  let data = [...groups].map(([c, g]) => {
    const row: Record<string, string | number> = { category: c }
    let total = 0
    for (const s of series) { const v = g.has(s) ? measure(g.get(s)!, f.value, f.agg) : 0; row[s] = v; total += v }
    row.__total = total
    return row
  })
  const cmp: Record<string, (a: Record<string, string | number>, b: Record<string, string | number>) => number> = {
    'value-desc': (a, b) => Number(b.__total) - Number(a.__total),
    'value-asc': (a, b) => Number(a.__total) - Number(b.__total),
    'cat-asc': (a, b) => String(a.category).localeCompare(String(b.category), 'ru', { numeric: true }),
    'cat-desc': (a, b) => String(b.category).localeCompare(String(a.category), 'ru', { numeric: true }),
  }
  data = data.sort(cmp[fmt.sort])
  if (fmt.topN > 0) data = data.slice(0, fmt.topN)
  return { categories: data.map((d) => String(d.category)), series, data }
}

export function scatterPoints(rows: Row[], f: Fields, types: Record<string, string>) {
  if (!f.category || !f.value || !f.value2) return []
  const groups = new Map<string, Row[]>()
  for (const r of rows) { const k = keyOf(r, f.category, types); if (!groups.has(k)) groups.set(k, []); groups.get(k)!.push(r) }
  return [...groups].map(([label, g]) => ({ label, x: measure(g, f.value, f.agg), y: measure(g, f.value2, f.agg) }))
}

export interface Pivot { rows: string[]; cols: string[]; cells: Record<string, Record<string, number>>; rowTotals: Record<string, number>; colTotals: Record<string, number>; total: number }

export function pivot(rows: Row[], f: Fields, types: Record<string, string>): Pivot {
  const empty: Pivot = { rows: [], cols: [], cells: {}, rowTotals: {}, colTotals: {}, total: 0 }
  if (!f.category) return empty
  const by = (pred: (r: Row) => boolean) => measure(rows.filter(pred), f.value, f.agg)
  const rKeys = [...new Set(rows.map((r) => keyOf(r, f.category!, types)))].sort((a, b) => a.localeCompare(b, 'ru', { numeric: true })).slice(0, 200)
  const cKeys = f.series ? [...new Set(rows.map((r) => keyOf(r, f.series!, types)))].sort((a, b) => a.localeCompare(b, 'ru', { numeric: true })).slice(0, 30) : ['Итого']
  const cells: Pivot['cells'] = {}
  for (const rk of rKeys) {
    cells[rk] = {}
    for (const ck of cKeys) cells[rk][ck] = by((r) => keyOf(r, f.category!, types) === rk && (!f.series || keyOf(r, f.series, types) === ck))
  }
  return {
    rows: rKeys, cols: cKeys, cells,
    rowTotals: Object.fromEntries(rKeys.map((rk) => [rk, by((r) => keyOf(r, f.category!, types) === rk)])),
    colTotals: Object.fromEntries(cKeys.map((ck) => [ck, f.series ? by((r) => keyOf(r, f.series!, types) === ck) : by(() => true)])),
    total: by(() => true),
  }
}

/** Table: groups by the selected text/date columns, aggregates the numeric ones. */
export function tableRows(rows: Row[], f: Fields, fmt: Pick<Format, 'sort' | 'topN'>, types: Record<string, string>) {
  const dims = f.columns.filter((c) => types[c] && types[c] !== 'number')
  const measures = f.columns.filter((c) => types[c] === 'number')
  const groups = new Map<string, Row[]>()
  for (const r of rows) { const k = dims.map((d) => keyOf(r, d, types)).join('\u0001'); if (!groups.has(k)) groups.set(k, []); groups.get(k)!.push(r) }
  let out = [...groups].map(([k, g]) => {
    const parts = k.split('\u0001')
    const row: Record<string, string | number> = {}
    dims.forEach((d, i) => { row[d] = parts[i] })
    measures.forEach((m) => { row[m] = reduce(g.map((r) => num(r[m])).filter((x): x is number => x !== null), f.agg === 'count' ? 'sum' : f.agg) })
    if (!measures.length) row['Количество'] = g.length
    return row
  })
  const sortKey = measures[0] ?? (measures.length ? '' : 'Количество')
  if (fmt.sort.startsWith('value') && sortKey) out = out.sort((a, b) => (fmt.sort === 'value-desc' ? 1 : -1) * (Number(b[sortKey]) - Number(a[sortKey])))
  else if (dims[0]) out = out.sort((a, b) => (fmt.sort === 'cat-desc' ? -1 : 1) * String(a[dims[0]]).localeCompare(String(b[dims[0]]), 'ru', { numeric: true }))
  const headers = [...dims, ...(measures.length ? measures : ['Количество'])]
  return { headers, numeric: new Set(measures.length ? measures : ['Количество']), rows: fmt.topN > 0 ? out.slice(0, fmt.topN) : out.slice(0, 1000) }
}

export function distinctValues(rows: Row[], column: string, types: Record<string, string>): string[] {
  return [...new Set(rows.map((r) => keyOf(r, column, types)))].sort((a, b) => a.localeCompare(b, 'ru', { numeric: true })).slice(0, 500)
}

const intl = (o: Intl.NumberFormatOptions) => new Intl.NumberFormat('ru-RU', o)
export function formatValue(v: number, nf: NumberFormat, prefix = '', suffix = ''): string {
  let s: string
  switch (nf) {
    case 'int': s = intl({ maximumFractionDigits: 0 }).format(v); break
    case 'dec2': s = intl({ minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v); break
    case 'thousands': s = `${intl({ maximumFractionDigits: 1 }).format(v / 1e3)} тыс.`; break
    case 'millions': s = `${intl({ maximumFractionDigits: 2 }).format(v / 1e6)} млн`; break
    case 'percent': s = intl({ style: 'percent', maximumFractionDigits: 1 }).format(v); break
    default: s = Math.abs(v) >= 1e6 ? intl({ notation: 'compact', maximumFractionDigits: 1 }).format(v) : intl({ maximumFractionDigits: 2 }).format(v)
  }
  return `${prefix}${s}${suffix}`
}
