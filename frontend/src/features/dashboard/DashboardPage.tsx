import { Bot, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ChartCard, chartColors, tooltipStyle } from '../../components/data-display/ChartCard'
import { MetricCard } from '../../components/data-display/MetricCard'
import { PageHeader } from '../../components/feedback/PageHeader'
import { ValidationBadge } from '../../components/ui/StatusBadge'
import { formatNumber, formatPercent } from '../../lib/format'
import { dashboard, periodMeta, QUALITY_CHECKS } from '../../mocks/data'
import { useUi } from '../../stores/ui'

export function DashboardPage() {
  const period = useUi((s) => s.period)
  const meta = periodMeta(period)
  const d = dashboard(period)
  const caption = period === 'M12' ? 'нет сравнения: мало истории' : 'к предыдущему периоду'
  const top = d.byGroup[0]

  return (
    <div className="space-y-6">
      <PageHeader title="Обзор бизнеса" description={`Как выглядит бизнес за период: ${meta.long}.`} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Выручка" value={`${formatNumber(d.revenue.value)} млн ₽`} delta={d.revenue.delta} caption={caption} />
        <MetricCard label="Валовая прибыль" value={`${formatNumber(d.gross.value)} млн ₽`} delta={d.gross.delta} caption={caption} />
        <MetricCard label="Валовая маржа" value={formatPercent(d.margin.value)} delta={d.margin.delta} unit="pp" caption={period === 'M12' ? caption : 'к предыдущему периоду'} />
        <MetricCard label="Стоимость запасов" value={`${formatNumber(d.inventory.value)} млн ₽`} delta={d.inventory.delta} higherIsBetter={false} caption="на конец периода" />
        <MetricCard label="Расходы на логистику" value={`${formatNumber(d.logistics.value)} млн ₽`} delta={d.logistics.delta} higherIsBetter={false} caption={caption} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <ChartCard title="Выручка и валовая прибыль" unit="млн ₽" period={meta.long} summary={`За последние ${d.trend.length} мес. выручка менялась от ${formatNumber(Math.min(...d.trend.map((t) => t.revenue)))} до ${formatNumber(Math.max(...d.trend.map((t) => t.revenue)))} млн ₽.`}>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={d.trend} margin={{ left: -12, right: 8, top: 4 }}>
                <defs>
                  <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={chartColors.primary} stopOpacity={0.3} /><stop offset="1" stopColor={chartColors.primary} stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid stroke={chartColors.grid} vertical={false} />
                <XAxis dataKey="month" stroke={chartColors.axis} fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke={chartColors.axis} fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip {...tooltipStyle} formatter={(v) => [`${formatNumber(Number(v))} млн ₽`]} />
                <Area type="monotone" dataKey="revenue" name="Выручка" stroke={chartColors.primary} strokeWidth={2} fill="url(#gRev)" />
                <Area type="monotone" dataKey="gross" name="Валовая прибыль" stroke={chartColors.cyan} strokeWidth={2} fill="none" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Выручка по товарным группам" unit="млн ₽" period={meta.long} summary={`Лидер — ${top.name}: ${formatNumber(top.revenue)} млн ₽.`}>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={d.byGroup.slice(0, 6)} layout="vertical" margin={{ left: 8, right: 8 }}>
                <CartesianGrid stroke={chartColors.grid} horizontal={false} />
                <XAxis type="number" stroke={chartColors.axis} fontSize={11} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="name" width={110} stroke={chartColors.axis} fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip {...tooltipStyle} formatter={(v) => [`${formatNumber(Number(v))} млн ₽`]} />
                <Bar dataKey="revenue" name="Выручка" fill={chartColors.primary} radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="Запасы по складам" unit="млн ₽" period="на конец периода" summary={d.byWarehouse.map((w) => `${w.name}: ${formatNumber(w.value)}`).join('; ')}>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={d.byWarehouse} margin={{ left: -12, right: 4 }}>
                <CartesianGrid stroke={chartColors.grid} vertical={false} />
                <XAxis dataKey="name" stroke={chartColors.axis} fontSize={10} tickLine={false} axisLine={false} interval={0} tickFormatter={(v: string) => v.split(' ').pop() ?? v} />
                <YAxis stroke={chartColors.axis} fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip {...tooltipStyle} formatter={(v) => [`${formatNumber(Number(v))} млн ₽`]} />
                <Bar dataKey="value" name="Запасы" fill={chartColors.blue} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <section className="rounded-[var(--radius-lg)] border border-border bg-surface-1 p-5">
          <h3 className="text-[15px] font-medium">Качество и актуальность данных</h3>
          <ul className="mt-4 space-y-3">
            {QUALITY_CHECKS.map((c) => (
              <li key={c.label} className="text-sm"><div className="flex items-center justify-between gap-2"><span>{c.label}</span><ValidationBadge status={c.status} /></div><p className="mt-1 text-xs text-muted">{c.detail}</p></li>
            ))}
          </ul>
        </section>

        <section className="flex flex-col rounded-[var(--radius-lg)] border border-border bg-surface-1 p-5">
          <div className="flex items-center gap-2 text-accent-ink"><Sparkles className="h-4 w-4" aria-hidden /><h3 className="text-[15px] font-medium text-fg">Что проверить дальше</h3></div>
          <ul className="mt-4 flex-1 space-y-3 text-sm text-text-soft">
            <li>Маржа «Электроника» — самая низкая среди групп и продолжает снижаться.</li>
            <li>Запасы без продаж 90+ дней сконцентрированы на двух складах.</li>
            <li>Для собственного автопарка нет отметок доставки — логистика считается частично.</li>
          </ul>
          <p className="mt-3 text-xs text-muted">Шаблонные подсказки на демо-данных. Реальные формирует AI-аналитик по вашим данным.</p>
          <Link to="/app/ai-analyst" className="mt-4 inline-flex items-center gap-2 text-sm text-accent-ink hover:underline"><Bot className="h-4 w-4" aria-hidden />Спросить AI-аналитика</Link>
        </section>
      </div>
    </div>
  )
}
