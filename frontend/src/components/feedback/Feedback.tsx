import { AlertTriangle, CheckCircle2, FlaskConical, Inbox, Loader2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '../ui/Button'

export function Alert({ tone = 'error', children }: { tone?: 'error' | 'success' | 'warning' | 'info'; children: ReactNode }) {
  const Icon = tone === 'success' ? CheckCircle2 : AlertTriangle
  const cls = { error: 'border-danger/40 text-danger', success: 'border-accent/40 text-accent-ink', warning: 'border-warning/40 text-warning', info: 'border-cyan/40 text-cyan' }[tone]
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`flex items-start gap-2 rounded-[var(--radius-md)] border px-3 py-2 text-sm ${cls}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div>{children}</div>
    </div>
  )
}

export function LoadingState({ label = 'Загрузка…' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center gap-2 p-8 text-sm text-muted">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> {label}
    </div>
  )
}

export function EmptyState({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-[var(--radius-lg)] border border-dashed border-border-strong px-6 py-12 text-center">
      <Inbox className="h-5 w-5 text-muted" aria-hidden />
      <p className="font-medium">{title}</p>
      {text && <p className="max-w-md text-sm text-muted">{text}</p>}
      {action}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-[var(--radius-lg)] border border-danger/30 p-6">
      <Alert>{message}</Alert>
      {onRetry && <Button variant="secondary" size="sm" onClick={onRetry}>Повторить</Button>}
    </div>
  )
}

/** Required on every screen that renders mock data (architecture §15). */
export function DemoBadge({ className = '' }: { className?: string }) {
  return (
    <span title="Данные на этом экране — демонстрационные, не из вашей 1С" className={`inline-flex items-center gap-1.5 rounded-full border border-violet/50 px-2.5 py-0.5 text-xs font-medium text-violet ${className}`}>
      <FlaskConical className="h-3 w-3" aria-hidden /> Демо-данные
    </span>
  )
}

export function DemoNotice({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-[var(--radius-md)] border border-violet/30 bg-violet/5 px-4 py-3 text-sm text-text-soft">
      <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-violet" aria-hidden />
      <div>{children}</div>
    </div>
  )
}
