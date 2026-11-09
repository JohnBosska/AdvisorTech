import { describe, expect, it } from 'vitest'
import type { DatasetColumn, Row, Widget } from '../../../lib/api/reports'
import { OTHER, group, kpi, toCsv, widgetError } from './aggregate'

const columns: DatasetColumn[] = [
  { name: 'Дата', type: 'date', samples: [] },
  { name: 'Группа', type: 'text', samples: [] },
  { name: 'Выручка', type: 'number', samples: [] },
]
const rows: Row[] = [
  { Дата: '02.02.2026', Группа: 'A', Выручка: 10 },
  { Дата: '01.01.2026', Группа: 'B', Выручка: 30 },
  { Дата: '02.02.2026', Группа: 'A', Выручка: 5 },
  { Дата: '03.03.2026', Группа: 'C', Выручка: null },
  { Дата: '03.03.2026', Группа: 'D', Выручка: 1 },
]
const w = (p: Partial<Widget>): Widget => ({ type: 'bar', title: 't', x: null, y: 'Выручка', agg: 'sum', limit: 12, ...p })

describe('report aggregation', () => {
  it('computes KPIs and ignores empty cells', () => {
    expect(kpi(rows, w({ type: 'kpi' }))).toBe(46)
    expect(kpi(rows, w({ type: 'kpi', agg: 'avg' }))).toBe(11.5)
    expect(kpi(rows, w({ type: 'kpi', y: null, agg: 'count' }))).toBe(5)
  })
  it('groups by category, sorts by value and folds the tail into «Другое»', () => {
    expect(group(rows, w({ x: 'Группа' }), columns)).toEqual([{ label: 'B', value: 30 }, { label: 'A', value: 15 }, { label: 'D', value: 1 }])
    expect(group(rows, w({ x: 'Группа', limit: 2 }), columns)).toEqual([{ label: 'B', value: 30 }, { label: OTHER, value: 16 }])
  })
  it('sorts dates chronologically even in dd.mm.yyyy', () => {
    expect(group(rows, w({ type: 'line', x: 'Дата' }), columns).map((p) => p.label)).toEqual(['2026-01-01', '2026-02-02', '2026-03-03'])
  })
  it('validates hand-made widgets like the server', () => {
    expect(widgetError(w({ type: 'line', x: 'Группа' }), columns)).toMatch(/дат/)
    expect(widgetError(w({ y: 'Группа', x: 'Группа' }), columns)).toMatch(/числов/)
    expect(widgetError(w({ x: 'Группа' }), columns)).toBeNull()
  })
  it('guards CSV export against formula injection', () => {
    expect(toCsv([{ title: 'X', points: [{ label: '=cmd()', value: 1.5 }] }])).toBe('X\n"\'=cmd()";1,5')
  })
})
