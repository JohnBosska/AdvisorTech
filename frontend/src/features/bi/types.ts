import type { Aggregation, ColumnType, Dataset } from '../../lib/api/reports'

export type VisualType = 'card' | 'bar' | 'stacked' | 'barh' | 'line' | 'area' | 'pie' | 'donut' | 'scatter' | 'table' | 'matrix' | 'slicer' | 'text'
export type NumberFormat = 'auto' | 'int' | 'dec2' | 'thousands' | 'millions' | 'percent'
export type LegendPos = 'none' | 'top' | 'bottom' | 'right'
export type SortMode = 'value-desc' | 'value-asc' | 'cat-asc' | 'cat-desc'
export type ThemeId = 'neon' | 'light' | 'contrast'

export interface Fields {
  category: string | null // axis / rows (matrix) / slicer field
  series: string | null // legend / columns (matrix)
  value: string | null // measure (x for scatter)
  value2: string | null // second measure (y for scatter)
  agg: Aggregation
  columns: string[] // table columns
}

export interface Format {
  title: string
  showTitle: boolean
  titleSize: number
  titleColor: string
  fontSize: number
  textColor: string
  background: string
  bgOpacity: number
  border: boolean
  borderColor: string
  radius: number
  color: string // single-series colour ('' = theme)
  colors: Record<string, string> // per series / category overrides
  dataLabels: boolean
  legend: LegendPos
  numberFormat: NumberFormat
  prefix: string
  suffix: string
  axisX: boolean
  axisY: boolean
  grid: boolean
  sort: SortMode
  topN: number // 0 = all
  smooth: boolean
  text: string // text visual
  align: 'left' | 'center' | 'right'
}

export interface Filter { id: string; column: string; kind: 'values' | 'range'; values: string[]; min: number | null; max: number | null }

export interface Visual {
  id: string
  type: VisualType
  x: number
  y: number
  w: number
  h: number
  fields: Fields
  format: Format
  selected?: string[] // slicer state
}

export interface Page { id: string; name: string; visuals: Visual[]; filters: Filter[] }
export interface ReportSpec { version: 1; theme: ThemeId; pages: Page[]; filters: Filter[] }

export interface CrossFilter { visualId: string; column: string; value: string }
export type { Aggregation, ColumnType, Dataset }

export const GRID_COLS = 12
export const ROW_PX = 28

export const VISUALS: { type: VisualType; label: string; w: number; h: number }[] = [
  { type: 'card', label: 'Карточка', w: 3, h: 5 },
  { type: 'bar', label: 'Столбцы', w: 6, h: 9 },
  { type: 'stacked', label: 'Столбцы с накоплением', w: 6, h: 9 },
  { type: 'barh', label: 'Линейчатая', w: 6, h: 9 },
  { type: 'line', label: 'Линия', w: 6, h: 9 },
  { type: 'area', label: 'Область', w: 6, h: 9 },
  { type: 'pie', label: 'Круговая', w: 4, h: 9 },
  { type: 'donut', label: 'Кольцевая', w: 4, h: 9 },
  { type: 'scatter', label: 'Точечная', w: 6, h: 9 },
  { type: 'table', label: 'Таблица', w: 6, h: 9 },
  { type: 'matrix', label: 'Матрица', w: 6, h: 9 },
  { type: 'slicer', label: 'Срез', w: 3, h: 7 },
  { type: 'text', label: 'Текст', w: 4, h: 3 },
]

export const uid = () => Math.random().toString(36).slice(2, 10)

export function defaultFormat(type: VisualType, title = ''): Format {
  return {
    title, showTitle: type !== 'text', titleSize: 14, titleColor: '', fontSize: 11, textColor: '',
    background: '', bgOpacity: 100, border: true, borderColor: '', radius: 14,
    color: '', colors: {}, dataLabels: false, legend: type === 'pie' || type === 'donut' ? 'right' : 'none',
    numberFormat: 'auto', prefix: '', suffix: '', axisX: true, axisY: true, grid: true,
    sort: type === 'line' || type === 'area' ? 'cat-asc' : 'value-desc', topN: type === 'pie' || type === 'donut' ? 6 : 0, smooth: true,
    text: type === 'text' ? 'Новый текст' : '', align: 'left',
  }
}

export function emptyFields(): Fields { return { category: null, series: null, value: null, value2: null, agg: 'sum', columns: [] } }

export function newVisual(type: VisualType, at: { x: number; y: number }, fields: Partial<Fields> = {}, title = ''): Visual {
  const def = VISUALS.find((v) => v.type === type)!
  return { id: uid(), type, x: at.x, y: at.y, w: def.w, h: def.h, fields: { ...emptyFields(), ...fields }, format: defaultFormat(type, title) }
}

export function newPage(name: string): Page { return { id: uid(), name, visuals: [], filters: [] } }
export function emptySpec(): ReportSpec { return { version: 1, theme: 'neon', pages: [newPage('Страница 1')], filters: [] } }

/** First free row below everything on the page. */
export function nextY(page: Page): number { return page.visuals.reduce((m, v) => Math.max(m, v.y + v.h), 0) }

/** Places a w×h box at the first spot (row-major) where it doesn't overlap existing visuals. */
export function findSpot(page: Page, w: number, h: number): { x: number; y: number } {
  const overlaps = (x: number, y: number) => page.visuals.some((v) => x < v.x + v.w && x + w > v.x && y < v.y + v.h && y + h > v.y)
  const limit = nextY(page) + 1
  for (let y = 0; y <= limit; y++) for (let x = 0; x + w <= GRID_COLS; x++) if (!overlaps(x, y)) return { x, y }
  return { x: 0, y: limit }
}
