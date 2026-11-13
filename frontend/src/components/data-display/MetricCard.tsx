import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import { formatDelta } from '../../lib/format'

interface MetricCardProps {
  label: string
  value: string
  /** % change vs previous period; null when no comparison is available */
  delta: number | null
  /** true when a rising value is good (revenue); false for costs */
  higherIsBetter?: boolean
  caption: string
  /** 'pp' when delta is in percentage points rather than percent */
  unit?: 'percent' | 'pp'
}

export function MetricCard({ label, value, delta, higherIsBetter = true, caption, unit = 'percent' }: MetricCardProps) {
  const good = delta === null || delta === 0 ? null : (delta > 0) === higherIsBetter
  const Icon = delta === null || delta === 0 ? Minus : delta > 0 ? ArrowUpRight : ArrowDownRight
  return (
    <section aria-label={label} className="rounded-[var(--radius-lg)] border border-border bg-surface-1 p-5">
      <p className="text-[13px] text-muted">{label}</p>
      <p className="tabular mt-3 text-[28px] font-semibold leading-none tracking-tight">{value}</p>
      <div className="mt-3 flex items-center gap-2 text-xs">
        <span className={`inline-flex items-center gap-0.5 font-medium ${good === null ? 'text-muted' : good ? 'text-accent-ink' : 'text-danger'}`}>
          <Icon className="h-3.5 w-3.5" aria-hidden />
          {delta === null ? 'нет сравнения' : unit === 'pp' ? `${formatDelta(delta).replace('%', '')} п.п.` : formatDelta(delta)}
          <span className="sr-only">{good === null ? '' : good ? ', улучшение' : ', ухудшение'}</span>
        </span>
        <span className="text-muted">{caption}</span>
      </div>
    </section>
  )
}
