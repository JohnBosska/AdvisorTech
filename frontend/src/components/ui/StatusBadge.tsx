import { AlertTriangle, CheckCircle2, CircleDashed, Loader2, ShieldAlert, XCircle } from 'lucide-react'
import type { ComponentType } from 'react'

export type Tone = 'success' | 'warning' | 'danger' | 'neutral' | 'info'
const tones: Record<Tone, string> = {
  success: 'border-accent/40 text-accent-ink',
  warning: 'border-warning/40 text-warning',
  danger: 'border-danger/40 text-danger',
  neutral: 'border-border-strong text-muted',
  info: 'border-cyan/40 text-cyan',
}

export function Badge({ tone = 'neutral', children, icon: Icon }: { tone?: Tone; children: React.ReactNode; icon?: ComponentType<{ className?: string }> }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}>
      {Icon && <Icon className="h-3 w-3" />}
      {children}
    </span>
  )
}

export type ValidationStatus = 'VALIDATED' | 'PARTIALLY_VALIDATED' | 'REQUIRES_ATTENTION' | 'FAILED'
const validation: Record<ValidationStatus, { label: string; tone: Tone; icon: ComponentType<{ className?: string }> }> = {
  VALIDATED: { label: 'Проверено', tone: 'success', icon: CheckCircle2 },
  PARTIALLY_VALIDATED: { label: 'Проверено частично', tone: 'warning', icon: AlertTriangle },
  REQUIRES_ATTENTION: { label: 'Требует внимания', tone: 'warning', icon: ShieldAlert },
  FAILED: { label: 'Не пройдена проверка', tone: 'danger', icon: XCircle },
}
export function ValidationBadge({ status }: { status: ValidationStatus }) {
  const v = validation[status]
  return <Badge tone={v.tone} icon={v.icon}>{v.label}</Badge>
}

export type RunState = 'queued' | 'processing' | 'ready' | 'failed' | 'expired'
const runStates: Record<RunState, { label: string; tone: Tone; icon: ComponentType<{ className?: string }> }> = {
  queued: { label: 'В очереди', tone: 'neutral', icon: CircleDashed },
  processing: { label: 'Формируется', tone: 'info', icon: Loader2 },
  ready: { label: 'Готов', tone: 'success', icon: CheckCircle2 },
  failed: { label: 'Ошибка', tone: 'danger', icon: XCircle },
  expired: { label: 'Срок истёк', tone: 'neutral', icon: CircleDashed },
}
export function RunStateBadge({ state }: { state: RunState }) {
  const v = runStates[state]
  return <Badge tone={v.tone} icon={v.icon}>{v.label}</Badge>
}
