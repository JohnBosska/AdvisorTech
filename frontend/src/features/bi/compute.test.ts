import { describe, expect, it } from 'vitest'
import type { Dataset } from '../../lib/api/reports'
import { BLANK, applyFilters, cardValue, categorySeries, columnTypes, formatValue, pivot, scatterPoints, tableRows, visualFilters } from './compute'
import { emptyFields, findSpot, newPage, newVisual, type Filter } from './types'

const ds: Dataset = {
  filename: 't', total_rows: 5, truncated: false,
  columns: [{ name: 'Месяц', type: 'date', samples: [] }, { name: 'Группа', type: 'text', samples: [] }, { name: 'Склад', type: 'text', samples: [] }, { name: 'Выручка', type: 'number', samples: [] }, { name: 'Кол', type: 'number', samples: [] }],
  rows: [
    { Месяц: '2026-01-01', Группа: 'A', Склад: 'М', Выручка: 10, Кол: 1 },
    { Месяц: '2026-01-01', Группа: 'B', Склад: 'К', Выручка: 30, Кол: 3 },
    { Месяц: '2026-02-01', Группа: 'A', Склад: 'К', Выручка: 5, Кол: 2 },
    { Месяц: '2026-02-01', Группа: 'C', Склад: 'М', Выручка: 20, Кол: 4 },
    { Месяц: '2026-03-01', Группа: null, Склад: 'М', Выручка: 1, Кол: 1 },
  ],
}
const t = columnTypes(ds)
const F = (p: Partial<ReturnType<typeof emptyFields>>) => ({ ...emptyFields(), ...p })
const vf = (p: Partial<Filter>): Filter => ({ id: 'f', column: '', kind: 'values', values: [], min: null, max: null, ...p })

describe('BI compute', () => {
  it('cards aggregate a measure or count rows', () => {
    expect(cardValue(ds.rows, F({ value: 'Выручка' }))).toBe(66)
    expect(cardValue(ds.rows, F({ value: 'Выручка', agg: 'max' }))).toBe(30)
    expect(cardValue(ds.rows, F({ agg: 'count' }))).toBe(5)
  })

  it('groups by category and series, sorts and cuts top-N, keeps blanks visible', () => {
    const r = categorySeries(ds.rows, F({ category: 'Группа', value: 'Выручка' }), { sort: 'value-desc', topN: 0 }, t)
    expect(r.categories).toEqual(['B', 'C', 'A', BLANK])
    const s = categorySeries(ds.rows, F({ category: 'Месяц', series: 'Склад', value: 'Выручка' }), { sort: 'cat-asc', topN: 2 }, t)
    expect(s.series).toEqual(['К', 'М'])
    expect(s.data).toEqual([{ category: '2026-01-01', К: 30, М: 10, __total: 40 }, { category: '2026-02-01', К: 5, М: 20, __total: 25 }])
  })

  it('applies value and range filters, including dates', () => {
    expect(applyFilters(ds.rows, [vf({ column: 'Склад', values: ['М'] })], t)).toHaveLength(3)
    expect(applyFilters(ds.rows, [vf({ column: 'Выручка', kind: 'range', min: 10, max: 25 })], t)).toHaveLength(2)
    expect(applyFilters(ds.rows, [vf({ column: 'Месяц', kind: 'range', min: Date.parse('2026-02-01'), max: null })], t)).toHaveLength(3)
  })

  it('combines report, page, slicer and cross filters but never filters a visual by itself', () => {
    const chart = newVisual('bar', { x: 0, y: 0 })
    const slicer = { ...newVisual('slicer', { x: 0, y: 0 }, { category: 'Склад' }), selected: ['К'] }
    const all = visualFilters(chart, [vf({ column: 'Группа', values: ['A', 'B'] })], [], [slicer], { visualId: 'other', column: 'Месяц', value: '2026-01-01' })
    expect(applyFilters(ds.rows, all, t)).toEqual([ds.rows[1]])
    expect(visualFilters(slicer, [], [], [slicer], { visualId: slicer.id, column: 'x', value: 'y' })).toEqual([])
  })

  it('builds a matrix with totals', () => {
    const p = pivot(ds.rows, F({ category: 'Склад', series: 'Месяц', value: 'Выручка' }), t)
    expect(p.cells['М']['2026-02-01']).toBe(20)
    expect(p.rowTotals['К']).toBe(35)
    expect(p.colTotals['2026-01-01']).toBe(40)
    expect(p.total).toBe(66)
  })

  it('aggregates table rows by dimensions and scatter points by category', () => {
    const tb = tableRows(ds.rows, F({ columns: ['Склад', 'Выручка'] }), { sort: 'value-desc', topN: 0 }, t)
    expect(tb.rows).toEqual([{ Склад: 'К', Выручка: 35 }, { Склад: 'М', Выручка: 31 }])
    expect(scatterPoints(ds.rows, F({ category: 'Склад', value: 'Выручка', value2: 'Кол' }), t)).toContainEqual({ label: 'К', x: 35, y: 5 })
  })

  it('formats numbers', () => {
    expect(formatValue(1234567, 'millions')).toBe('1,23 млн')
    expect(formatValue(0.256, 'percent')).toMatch(/^25,6\s?%$/)
    expect(formatValue(1500, 'thousands', '', ' ₽')).toBe('1,5 тыс. ₽')
  })

  it('finds a free spot on the grid', () => {
    const p = newPage('p')
    p.visuals.push({ ...newVisual('bar', { x: 0, y: 0 }), w: 6, h: 4 })
    expect(findSpot(p, 6, 4)).toEqual({ x: 6, y: 0 })
    expect(findSpot(p, 8, 2)).toEqual({ x: 0, y: 4 })
  })
})
