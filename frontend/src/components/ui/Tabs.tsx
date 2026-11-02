interface TabsProps<T extends string> { tabs: { id: T; label: string }[]; value: T; onChange: (v: T) => void; label: string }

export function Tabs<T extends string>({ tabs, value, onChange, label }: TabsProps<T>) {
  return (
    <div role="tablist" aria-label={label} className="inline-flex gap-1 rounded-[var(--radius-md)] border border-border p-1">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          type="button"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={`rounded-[var(--radius-sm)] px-3 py-1.5 text-[13px] transition-colors ${value === t.id ? 'bg-surface-3 text-accent' : 'text-muted hover:text-white'}`}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
