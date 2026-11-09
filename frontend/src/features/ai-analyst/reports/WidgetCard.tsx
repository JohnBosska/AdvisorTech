import { X } from 'lucide-react'
import { useId } from 'react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { DatasetColumn, Row, Widget } from '../../../lib/api/reports'
import { OTHER, formatCompact, formatNumber, group, kpi, type Point } from './aggregate'

// Validated categorical order (dark surface, CVD-safe); single series use the Neon green.
export const SERIES = ['#00a370', '#5b8def', '#b5862f', '#9a7bf0', '#e0645f']
const NEON = '#00e599'
const OTHER_GRAY = '#4b5552'
const AGG_LABEL = { sum: 'сумма', avg: 'среднее', count: 'количество', min: 'минимум', max: 'максимум' } as const

function GlassTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; payload: Point }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="glass-tip">
      <p className="text-[11px] text-white/60">{label ?? payload[0].payload.label}</p>
      <p className="font-mono text-[13px] text-white">{formatNumber(payload[0].value)}</p>
    </div>
  )
}

const axis = { stroke: 'rgb(255 255 255 / 0.35)', fontSize: 11, tickLine: false, axisLine: false } as const

export function widgetPoints(rows: Row[], w: Widget, columns: DatasetColumn[]): Point[] {
  return w.type === 'kpi' ? [{ label: w.title, value: kpi(rows, w) }] : group(rows, w, columns)
}

export function WidgetCard({ w, rows, columns, onRemove }: { w: Widget; rows: Row[]; columns: DatasetColumn[]; onRemove: () => void }) {
  const points = widgetPoints(rows, w, columns)
  const measure = w.y ? `${AGG_LABEL[w.agg]} · ${w.y}` : 'количество строк'
  const gid = `g${useId().replace(/:/g, '')}`
  const wide = w.type === 'line' || w.type === 'table'

  return (
    <figure className={`glass group relative flex flex-col p-4 ${wide ? 'md:col-span-2' : ''} ${w.type === 'kpi' ? 'min-h-[140px] self-start' : 'min-h-[230px]'}`}>
      <figcaption className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[14px] font-medium text-white">{w.title}</p>
          <p className="truncate font-mono text-[11px] text-white/45">{measure}{w.x ? ` · по «${w.x}»` : ''}</p>
        </div>
        <button type="button" onClick={onRemove} aria-label={`Удалить виджет «${w.title}»`} className="rounded-full p-1 text-white/40 opacity-100 transition hover:bg-white/10 hover:text-white md:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100"><X className="h-3.5 w-3.5" /></button>
      </figcaption>

      {points.length === 0 && <p className="m-auto text-xs text-white/45">Нет данных для этих колонок</p>}

      {w.type === 'kpi' && (
        <p className="mt-6 lp-display text-[clamp(2rem,4vw,2.8rem)] leading-none tracking-tight text-white">{formatNumber(points[0].value)}</p>
      )}

      {w.type === 'bar' && points.length > 0 && (
        <div className="mt-3 h-[180px] flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={points} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="rgb(255 255 255 / 0.06)" />
              <XAxis dataKey="label" {...axis} interval={0} tickFormatter={(v: string) => (v.length > 10 ? `${v.slice(0, 9)}…` : v)} />
              <YAxis {...axis} tickFormatter={formatCompact} width={60} />
              <Tooltip content={<GlassTooltip />} cursor={{ fill: 'rgb(255 255 255 / 0.04)' }} />
              <Bar isAnimationActive={false} dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={36}>
                {points.map((p) => <Cell key={p.label} fill={p.label === OTHER ? OTHER_GRAY : NEON} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {w.type === 'line' && points.length > 0 && (
        <div className="mt-3 h-[200px] flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={NEON} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={NEON} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="rgb(255 255 255 / 0.06)" />
              <XAxis dataKey="label" {...axis} minTickGap={24} />
              <YAxis {...axis} tickFormatter={formatCompact} width={60} />
              <Tooltip content={<GlassTooltip />} cursor={{ stroke: 'rgb(255 255 255 / 0.25)' }} />
              <Area isAnimationActive={false} type="monotone" dataKey="value" stroke={NEON} strokeWidth={2} fill={`url(#${gid})`} activeDot={{ r: 4, stroke: '#050807', strokeWidth: 2 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {w.type === 'pie' && points.length > 0 && (
        <div className="mt-3 flex flex-1 items-center gap-4">
          <div className="h-[150px] w-[150px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip content={<GlassTooltip />} />
                <Pie isAnimationActive={false} data={points.slice(0, 6)} dataKey="value" nameKey="label" innerRadius="62%" outerRadius="100%" paddingAngle={2} stroke="none">
                  {points.slice(0, 6).map((p, i) => <Cell key={p.label} fill={p.label === OTHER ? OTHER_GRAY : SERIES[i % SERIES.length]} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="min-w-0 space-y-1.5 text-[12px]">
            {points.slice(0, 6).map((p, i) => (
              <li key={p.label} className="flex items-center gap-2">
                <i className="h-2 w-2 shrink-0 rounded-full" style={{ background: p.label === OTHER ? OTHER_GRAY : SERIES[i % SERIES.length] }} />
                <span className="truncate text-white/70">{p.label}</span>
                <span className="ml-auto pl-2 font-mono text-white">{formatCompact(p.value)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {w.type === 'table' && points.length > 0 && (
        <div className="mt-3 max-h-[260px] overflow-auto">
          <table className="w-full text-[12px]">
            <thead><tr className="text-left text-white/45"><th className="pb-2 font-normal">{w.x}</th><th className="pb-2 text-right font-normal">{AGG_LABEL[w.agg]}</th></tr></thead>
            <tbody>
              {points.map((p) => <tr key={p.label} className="border-t border-white/[0.06]"><td className="py-1.5 pr-3 text-white/80">{p.label}</td><td className="py-1.5 text-right font-mono text-white">{formatNumber(p.value)}</td></tr>)}
            </tbody>
          </table>
        </div>
      )}
    </figure>
  )
}
