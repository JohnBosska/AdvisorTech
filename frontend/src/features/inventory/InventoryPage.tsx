import type { ColumnDef } from '@tanstack/react-table'
import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ChartCard, chartColors, tooltipStyle } from '../../components/data-display/ChartCard'
import { DataTable } from '../../components/data-display/DataTable'
import { MetricCard } from '../../components/data-display/MetricCard'
import { PageHeader } from '../../components/feedback/PageHeader'
import { SelectField } from '../../components/ui/Field'
import { Badge } from '../../components/ui/StatusBadge'
import { formatNumber, formatRub } from '../../lib/format'
import { dashboard, SHORTAGE_RISKS, STOCK_ITEMS, WAREHOUSES, type StockItem } from '../../mocks/data'
import { useUi } from '../../stores/ui'

export function InventoryPage() {
  const period = useUi((s) => s.period)
  const d = dashboard(period)
  const [warehouse, setWarehouse] = useState('all')
  const [minDays, setMinDays] = useState(90)

  const slowAll = STOCK_ITEMS.filter((i) => i.daysNoSales >= minDays)
  const slow = warehouse === 'all' ? slowAll : slowAll.filter((i) => i.warehouse === warehouse)
  const slowValue = slow.reduce((s, i) => s + i.value, 0)
  const byWarehouse = WAREHOUSES.map((w) => ({ name: w.name, value: +(slowAll.filter((i) => i.warehouse === w.name).reduce((s, i) => s + i.value, 0) / 1e6).toFixed(2) }))

  const columns = useMemo<ColumnDef<StockItem>[]>(() => [
    { accessorKey: 'sku', header: 'Артикул', cell: (c) => <span className="font-mono text-xs">{c.getValue<string>()}</span> },
    { accessorKey: 'name', header: 'Позиция' },
    { accessorKey: 'group', header: 'Группа' },
    { accessorKey: 'warehouse', header: 'Склад' },
    { accessorKey: 'qty', header: 'Кол-во', meta: { numeric: true } },
    { accessorKey: 'value', header: 'Стоимость', meta: { numeric: true }, cell: (c) => formatRub(c.getValue<number>()) },
    { accessorKey: 'daysNoSales', header: 'Дней без продаж', meta: { numeric: true }, cell: (c) => { const v = c.getValue<number>(); return <span className={v >= 150 ? 'text-danger' : v >= 90 ? 'text-warning' : ''}>{v}</span> } },
  ], [])

  return (
    <div className="space-y-6">
      <PageHeader title="Запасы и склады" description="Где накапливаются запасы, какие позиции не движутся и какие могут закончиться." />
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Стоимость запасов" value={`${formatNumber(d.inventory.value)} млн ₽`} delta={d.inventory.delta} higherIsBetter={false} caption="к прошлому месяцу" />
        <MetricCard label={`Без продаж ${minDays}+ дней`} value={formatRub(slowValue)} delta={null} caption={warehouse === 'all' ? 'по всем складам' : 'по выбранному складу'} />
        <MetricCard label="Позиции под риском дефицита" value={String(SHORTAGE_RISKS.filter((r) => r.coverDays < r.leadDays).length)} delta={null} caption="запас меньше срока поставки" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <ChartCard title="Запасы без движения по складам" unit="млн ₽" period={`без продаж ${minDays}+ дней`} summary={byWarehouse.map((w) => `${w.name}: ${w.value}`).join('; ')}>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byWarehouse} layout="vertical" margin={{ left: 8, right: 8 }}>
                <CartesianGrid stroke={chartColors.grid} horizontal={false} />
                <XAxis type="number" stroke={chartColors.axis} fontSize={11} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="name" width={120} stroke={chartColors.axis} fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip {...tooltipStyle} formatter={(v) => [`${v} млн ₽`]} />
                <Bar dataKey="value" name="Без движения" radius={[0, 3, 3, 0]}>
                  {byWarehouse.map((w) => <Cell key={w.name} fill={warehouse === 'all' || warehouse === w.name ? chartColors.primary : '#26292d'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <section className="rounded-[var(--radius-lg)] border border-border bg-surface-1 p-5">
          <h3 className="text-[15px] font-medium">Риск дефицита</h3>
          <p className="mt-0.5 font-mono text-[11px] text-muted">покрытие запасом vs срок поставки · допущение: средние продажи за 30 дней</p>
          <ul className="mt-4 divide-y divide-border">
            {SHORTAGE_RISKS.map((r) => (
              <li key={r.sku} className="flex items-center justify-between gap-3 py-3 text-sm">
                <div><p className="font-medium">{r.name}</p><p className="text-xs text-muted">{r.group} · <span className="font-mono">{r.sku}</span></p></div>
                <div className="text-right"><p className="tabular">{r.coverDays} дн. запаса</p><Badge tone={r.coverDays < r.leadDays ? 'danger' : 'warning'}>{r.coverDays < r.leadDays ? `поставка ${r.leadDays} дн. — не успеет` : 'на грани'}</Badge></div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div>
        <div className="mb-3 flex flex-wrap items-end gap-4">
          <SelectField label="Склад" value={warehouse} onChange={(e) => setWarehouse(e.target.value)} className="w-56">
            <option value="all">Все склады</option>
            {WAREHOUSES.map((w) => <option key={w.id} value={w.name}>{w.name}</option>)}
          </SelectField>
          <SelectField label="Порог без продаж" value={minDays} onChange={(e) => setMinDays(Number(e.target.value))} className="w-44">
            {[60, 90, 120, 180].map((n) => <option key={n} value={n}>{n} дней</option>)}
          </SelectField>
          <p className="pb-2 text-xs text-muted">Определение «медленного запаса» не утверждено; порог настраивается.</p>
        </div>
        <DataTable data={slow} columns={columns} caption="Позиции без движения" searchPlaceholder="Найти позицию…" />
      </div>
    </div>
  )
}
