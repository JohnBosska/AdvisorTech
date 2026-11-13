import type { ReactNode } from 'react'

/** Chart shell: title, unit, period, and a text alternative for assistive tech. */
export function ChartCard({ title, unit, period, summary, children, action }: { title: string; unit: string; period: string; summary: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="rounded-[var(--radius-lg)] border border-border bg-surface-1 p-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[15px] font-medium">{title}</h3>
          <p className="mt-0.5 font-mono text-[11px] text-muted">{unit} · {period}</p>
        </div>
        {action}
      </header>
      <div className="mt-4" role="img" aria-label={`${title}. ${summary}`}>{children}</div>
      <p className="sr-only">{summary}</p>
    </section>
  )
}

export const chartColors = { primary: '#34d59a', cyan: '#62ddeb', blue: '#557eea', violet: '#8a74d6', grid: 'var(--color-border)', axis: 'var(--color-muted)' }

export const tooltipStyle = {
  contentStyle: { background: 'var(--color-surface-1)', border: '1px solid var(--color-border-strong)', borderRadius: 6, fontSize: 12, color: 'var(--color-fg)' },
  labelStyle: { color: 'var(--color-muted)' },
  itemStyle: { color: '#fff' },
  cursor: { fill: 'color-mix(in srgb, var(--color-fg) 5%, transparent)' },
}
