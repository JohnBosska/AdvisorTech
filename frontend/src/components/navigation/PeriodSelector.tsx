import { PERIODS } from '../../mocks/data'
import { useUi } from '../../stores/ui'

export function PeriodSelector() {
  const { period, setPeriod } = useUi()
  return (
    <label className="flex items-center gap-2 text-xs text-muted">
      <span className="hidden sm:inline">Период</span>
      <select value={period} onChange={(e) => setPeriod(e.target.value as typeof period)} aria-label="Отчётный период" className="h-8 rounded-[var(--radius-md)] border border-border bg-surface-1 px-2 text-[13px] text-fg hover:border-border-strong">
        {PERIODS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
      </select>
    </label>
  )
}
