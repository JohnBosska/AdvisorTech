const rub = new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 })
const compact = new Intl.NumberFormat('ru-RU', { notation: 'compact', maximumFractionDigits: 1 })
const num = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 })
const date = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
const dateTime = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

export const formatRub = (v: number) => rub.format(v)
export const formatRubCompact = (v: number) => `${compact.format(v)} ₽`
export const formatNumber = (v: number) => num.format(v)
export const formatPercent = (v: number, digits = 1) => `${v.toFixed(digits).replace('.', ',')}%`
export const formatDelta = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(1).replace('.', ',')}%`
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—'
  const d = typeof value === 'string' ? new Date(value) : value
  return Number.isNaN(d.getTime()) ? '—' : date.format(d)
}
export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—'
  const d = typeof value === 'string' ? new Date(value) : value
  return Number.isNaN(d.getTime()) ? '—' : dateTime.format(d)
}
