import type { ColumnDef } from '@tanstack/react-table'
import { useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ChartCard, chartColors, tooltipStyle } from '../../components/data-display/ChartCard'
import { DataTable } from '../../components/data-display/DataTable'
import { PageHeader } from '../../components/feedback/PageHeader'
import { Button } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/Dialog'
import { formatNumber, formatPercent } from '../../lib/format'
import { downloadDemoCsv } from '../../mocks/export'
import { groupRows, groupTrend, periodMeta, type GroupRow } from '../../mocks/data'
import { useUi } from '../../stores/ui'

export function ProductAnalyticsPage() {
  const period = useUi((s) => s.period)
  const meta = periodMeta(period)
  const rows = useMemo(() => groupRows(period), [period])
  const [selected, setSelected] = useState<GroupRow | null>(null)
  const [minMargin, setMinMargin] = useState<'all' | 'low'>('all')

  const data = minMargin === 'low' ? rows.filter((r) => r.margin < 0.25) : rows
  const columns = useMemo<ColumnDef<GroupRow>[]>(() => [
    { accessorKey: 'name', header: 'Товарная группа', cell: (c) => <span className="font-medium">{c.getValue<string>()}</span> },
    { accessorKey: 'revenue', header: 'Выручка, млн ₽', meta: { numeric: true }, cell: (c) => formatNumber(c.getValue<number>()) },
    { accessorKey: 'gross', header: 'Валовая прибыль, млн ₽', meta: { numeric: true }, cell: (c) => formatNumber(c.getValue<number>()) },
    { accessorKey: 'margin', header: 'Маржа', meta: { numeric: true }, cell: (c) => formatPercent(c.getValue<number>() * 100) },
    { accessorKey: 'marginDelta', header: 'Δ маржи, п.п.', meta: { numeric: true }, cell: (c) => { const v = c.getValue<number | null>(); return v === null ? <span className="text-muted">н/д</span> : <span className={v < 0 ? 'text-danger' : 'text-accent'}>{v > 0 ? '+' : ''}{v.toFixed(1).replace('.', ',')}</span> } },
    { accessorKey: 'stock', header: 'Запасы, млн ₽', meta: { numeric: true }, cell: (c) => formatNumber(c.getValue<number>()) },
    { accessorKey: 'turnover', header: 'Оборачиваемость, обор./год', meta: { numeric: true }, cell: (c) => formatNumber(c.getValue<number>()) },
    { accessorKey: 'revenueShare', header: 'Доля выручки', meta: { numeric: true }, cell: (c) => formatPercent(c.getValue<number>() * 100) },
  ], [])

  const exportCsv = () => downloadDemoCsv('demo-product-groups.csv', [
    ['Товарная группа', 'Выручка, млн ₽', 'Валовая прибыль, млн ₽', 'Маржа, %', 'Запасы, млн ₽'],
    ...data.map((r) => [r.name, r.revenue.toFixed(2), r.gross.toFixed(2), (r.margin * 100).toFixed(1), r.stock]),
  ])

  return (
    <div className="space-y-6">
      <PageHeader title="Аналитика товарных групп" description={`Выручка, валовая прибыль и оборачиваемость по группам. Период: ${meta.long}.`} actions={<Button variant="secondary" size="sm" onClick={exportCsv}>Экспорт (демо CSV)</Button>} />
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Фильтр по марже">
        <Button size="sm" variant={minMargin === 'all' ? 'primary' : 'secondary'} aria-pressed={minMargin === 'all'} onClick={() => setMinMargin('all')}>Все группы</Button>
        <Button size="sm" variant={minMargin === 'low' ? 'primary' : 'secondary'} aria-pressed={minMargin === 'low'} onClick={() => setMinMargin('low')}>Маржа ниже 25%</Button>
        <span className="text-xs text-muted">Нажмите на строку, чтобы открыть детализацию группы.</span>
      </div>
      <DataTable data={data} columns={columns} caption="Прибыльность товарных групп" searchPlaceholder="Найти группу…" onRowClick={setSelected} />
      <p className="text-xs text-muted">Определения: валовая прибыль = выручка − себестоимость продаж; маржа = валовая прибыль ÷ выручка. Формулы KPI ещё не утверждены владельцем показателей (KPI Dictionary — черновик).</p>

      <Dialog open={!!selected} onClose={() => setSelected(null)} title={selected ? `Группа «${selected.name}»` : ''} description="Динамика за 12 месяцев" wide>
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div><p className="text-xs text-muted">Выручка</p><p className="tabular font-semibold">{formatNumber(selected.revenue)} млн ₽</p></div>
              <div><p className="text-xs text-muted">Валовая прибыль</p><p className="tabular font-semibold">{formatNumber(selected.gross)} млн ₽</p></div>
              <div><p className="text-xs text-muted">Маржа</p><p className="tabular font-semibold">{formatPercent(selected.margin * 100)}</p></div>
            </div>
            <ChartCard title="Выручка и маржа по месяцам" unit="млн ₽ / %" period="12 месяцев" summary={`Маржа группы в последнем месяце — ${groupTrend(selected.id).at(-1)?.margin}%.`}>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={groupTrend(selected.id)} margin={{ left: -12, right: 8 }}>
                    <CartesianGrid stroke={chartColors.grid} vertical={false} />
                    <XAxis dataKey="month" stroke={chartColors.axis} fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis yAxisId="l" stroke={chartColors.axis} fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis yAxisId="r" orientation="right" stroke={chartColors.axis} fontSize={11} tickLine={false} axisLine={false} unit="%" />
                    <Tooltip {...tooltipStyle} />
                    <Line yAxisId="l" type="monotone" dataKey="revenue" name="Выручка, млн ₽" stroke={chartColors.primary} strokeWidth={2} dot={false} />
                    <Line yAxisId="r" type="monotone" dataKey="margin" name="Маржа, %" stroke={chartColors.cyan} strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
          </div>
        )}
      </Dialog>
    </div>
  )
}
