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

export const chartColors = { primary: '#34d59a', cyan: '#62ddeb', blue: '#557eea', violet: '#8a74d6', grid: '#1d2023', axis: '#94979e' }

export const tooltipStyle = {
  contentStyle: { background: '#121413', border: '1px solid #3a3e44', borderRadius: 6, fontSize: 12, color: '#fff' },
  labelStyle: { color: '#94979e' },
  itemStyle: { color: '#fff' },
  cursor: { fill: 'rgb(255 255 255 / 4%)' },
}
