import { Monitor, Moon, Sun } from 'lucide-react'
import { useThemeStore, type AppTheme } from '../../stores/theme'

const OPTIONS: { id: AppTheme; label: string; icon: typeof Sun }[] = [
  { id: 'light', label: 'Светлая', icon: Sun },
  { id: 'dark', label: 'Тёмная', icon: Moon },
  { id: 'system', label: 'Как в системе', icon: Monitor },
]

export function ThemeSwitcher({ withLabels = false }: { withLabels?: boolean }) {
  const { theme, setTheme } = useThemeStore()
  return (
    <div role="radiogroup" aria-label="Тема интерфейса" className="inline-flex rounded-[var(--radius-md)] border border-border bg-surface-2 p-0.5">
      {OPTIONS.map(({ id, label, icon: Icon }) => (
        <button key={id} type="button" role="radio" aria-checked={theme === id} aria-label={label} title={label} onClick={() => setTheme(id)}
          className={`inline-flex h-7 items-center gap-1.5 rounded-[var(--radius-sm)] px-2 text-xs transition-colors ${theme === id ? 'bg-surface-1 text-fg shadow-sm' : 'text-muted hover:text-fg'}`}>
          <Icon className="h-3.5 w-3.5" aria-hidden />{withLabels && label}
        </button>
      ))}
    </div>
  )
}
