import type { ColumnDef } from '@tanstack/react-table'
import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ChartCard, chartColors, tooltipStyle } from '../../components/data-display/ChartCard'
import { DataTable } from '../../components/data-display/DataTable'
import { MetricCard } from '../../components/data-display/MetricCard'
import { Alert } from '../../components/feedback/Feedback'
import { PageHeader } from '../../components/feedback/PageHeader'
import { formatNumber, formatPercent, formatRub } from '../../lib/format'
import { logisticsView, periodMeta } from '../../mocks/data'
import { useUi } from '../../stores/ui'

type Row = ReturnType<typeof logisticsView>['carriers'][number]

export function LogisticsPage() {
  const period = useUi((s) => s.period)
  const meta = periodMeta(period)
  const v = logisticsView(period)

  const columns = useMemo<ColumnDef<Row>[]>(() => [
    { accessorKey: 'name', header: 'Перевозчик', cell: (c) => <span className="font-medium">{c.getValue<string>()}</span> },
    { accessorKey: 'shipments', header: 'Отправок', meta: { numeric: true }, cell: (c) => formatNumber(c.getValue<number>()) },
    { accessorKey: 'cost', header: 'Расходы, млн ₽', meta: { numeric: true }, cell: (c) => formatNumber(c.getValue<number>()) },
    { accessorKey: 'costPerShipment', header: 'Стоимость отправки', meta: { numeric: true }, cell: (c) => formatRub(c.getValue<number>()) },
    { accessorKey: 'avgDays', header: 'Ср. срок доставки, дн.', meta: { numeric: true }, cell: (c) => { const x = c.getValue<number | null>(); return x === null ? <span className="text-warning" title="Нет отметок отправки и доставки">н/д</span> : formatNumber(x) } },
    { accessorKey: 'onTimeShare', header: 'Вовремя', meta: { numeric: true }, cell: (c) => { const x = c.getValue<number | null>(); return x === null ? <span className="text-warning">н/д</span> : formatPercent(x * 100, 0) } },
  ], [])

  return (
    <div className="space-y-6">
      <PageHeader title="Аналитика логистики" description={`Расходы на доставку и эффективность перевозчиков. Период: ${meta.long}.`} />
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Расходы на логистику" value={`${formatNumber(v.cost)} млн ₽`} delta={v.delta} higherIsBetter={false} caption={period === 'M12' ? 'нет сравнения: мало истории' : 'к предыдущему периоду'} />
        <MetricCard label="Доля в выручке" value={formatPercent(v.shareOfRevenue)} delta={null} caption="расходы ÷ выручка" />
        <MetricCard label="Отправок за период" value={formatNumber(v.carriers.reduce((s, c) => s + c.shipments, 0))} delta={null} caption="по всем перевозчикам" />
      </div>
      <Alert tone="warning">Время доставки рассчитывается только там, где есть отметки отправки и доставки. Для «Собственного автопарка» таких данных нет, поэтому показатель недоступен (н/д), а не равен нулю. Расходы по маршрутам не распределены — разрез по маршрутам не показан.</Alert>
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Расходы на логистику по месяцам" unit="млн ₽" period="12 месяцев; выбранный период подсвечен" summary={`Расходы в выбранном периоде — ${formatNumber(v.cost)} млн ₽.`}>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={v.trend} margin={{ left: -12, right: 4 }}>
                <CartesianGrid stroke={chartColors.grid} vertical={false} />
                <XAxis dataKey="month" stroke={chartColors.axis} fontSize={10} tickLine={false} axisLine={false} interval={1} />
                <YAxis stroke={chartColors.axis} fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip {...tooltipStyle} formatter={(x) => [`${formatNumber(Number(x))} млн ₽`]} />
                <Bar dataKey="cost" name="Расходы" radius={[3, 3, 0, 0]}>{v.trend.map((t) => <Cell key={t.month} fill={t.inPeriod ? chartColors.primary : '#26292d'} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
        <ChartCard title="Расходы по товарным группам" unit="млн ₽" period={meta.long} summary="Распределение расходов на логистику между товарными группами (демо-распределение).">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={v.byGroup} layout="vertical" margin={{ left: 8, right: 8 }}>
                <CartesianGrid stroke={chartColors.grid} horizontal={false} />
                <XAxis type="number" stroke={chartColors.axis} fontSize={11} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="name" width={110} stroke={chartColors.axis} fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip {...tooltipStyle} formatter={(x) => [`${formatNumber(Number(x))} млн ₽`]} />
                <Bar dataKey="cost" name="Расходы" fill={chartColors.cyan} radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>
      <DataTable data={v.carriers} columns={columns} caption="Сравнение перевозчиков" searchPlaceholder="Найти перевозчика…" />
    </div>
  )
}
