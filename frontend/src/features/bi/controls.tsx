import type { ReactNode } from 'react'

export const inputCls = 'h-8 w-full rounded-lg border border-fg/10 bg-fg/[0.04] px-2 text-[12.5px] text-fg outline-none transition placeholder:text-fg/30 focus:border-accent/60'

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details open className="group border-b border-fg/[0.07] py-2.5 last:border-0">
      <summary className="cursor-pointer list-none text-[11px] font-medium uppercase tracking-[0.12em] text-fg/50 group-open:text-fg/75">{title}</summary>
      <div className="mt-2.5 space-y-2.5">{children}</div>
    </details>
  )
}

export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid grid-cols-[110px_minmax(0,1fr)] items-center gap-2 text-[12px] text-fg/65">
      <span className="truncate">{label}</span>
      <span className="min-w-0">{children}</span>
    </label>
  )
}

export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-2 text-[12px] text-fg/65">
      <span>{label}</span>
      <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} className={`relative h-5 w-9 shrink-0 rounded-full transition ${checked ? 'bg-accent' : 'bg-fg/15'}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-knob shadow-sm transition-all ${checked ? 'left-[18px]' : 'left-0.5'}`} />
      </button>
    </label>
  )
}

export function ColorInput({ label, value, fallback, onChange }: { label: string; value: string; fallback: string; onChange: (v: string) => void }) {
  return (
    <Row label={label}>
      <span className="flex items-center gap-1.5">
        <input type="color" aria-label={label} value={value || fallback} onChange={(e) => onChange(e.target.value)} className="h-8 w-9 shrink-0 cursor-pointer rounded-md border border-fg/10 bg-transparent p-0.5" />
        <span className="truncate font-mono text-[11px] text-fg/45">{value || 'тема'}</span>
        {value && <button type="button" onClick={() => onChange('')} className="ml-auto text-[11px] text-fg/45 hover:text-fg">сброс</button>}
      </span>
    </Row>
  )
}

export function NumberInput({ label, value, min, max, step = 1, onChange }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void }) {
  return (
    <Row label={label}>
      <span className="flex items-center gap-2">
        <input type="range" aria-label={label} min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="min-w-0 flex-1 accent-accent" />
        <input type="number" aria-label={`${label}, число`} min={min} max={max} step={step} value={value} onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value) || 0)))} className={`${inputCls} w-14 px-1.5 text-center`} />
      </span>
    </Row>
  )
}

export function Select<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { id: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <Row label={label}>
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value as T)} className={inputCls}>
        {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
    </Row>
  )
}
