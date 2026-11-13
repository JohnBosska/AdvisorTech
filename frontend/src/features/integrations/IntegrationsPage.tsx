import { CheckCircle2, CircleSlash, MinusCircle, Plus, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { DemoBadge, DemoNotice, EmptyState, ErrorState, LoadingState } from '../../components/feedback/Feedback'
import { PageHeader } from '../../components/feedback/PageHeader'
import { Button } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/Dialog'
import { Badge, ValidationBadge, type Tone } from '../../components/ui/StatusBadge'
import { describeApiError } from '../../lib/api/client'
import { useActiveOrganization, useConnections } from '../../lib/api/hooks'
import type { ConnectionStatus } from '../../lib/api/organizations'
import { formatDateTime, formatNumber } from '../../lib/format'
import { QUALITY_CHECKS, SYNC_ENTITIES, SYNC_HISTORY, type DemoSyncRun } from '../../mocks/data'
import { ConnectorPanel } from './ConnectorPanel'
import { ConnectionForm, CONFIG_LABEL, DBMS_LABEL, TRANSPORT_LABEL } from './ConnectionForm'

const STATUS: Record<ConnectionStatus, { label: string; tone: Tone }> = {
  DRAFT: { label: 'Черновик: агент не подключён', tone: 'neutral' },
  AWAITING_AGENT: { label: 'Ожидает агента', tone: 'info' },
  CONNECTED: { label: 'Подключено', tone: 'success' },
  ERROR: { label: 'Требует внимания', tone: 'warning' },
  REVOKED: { label: 'Доступ отозван', tone: 'danger' },
}
const MODE: Record<DemoSyncRun['mode'], string> = { FULL: 'Полная', INCREMENTAL: 'Инкрементальная', RECONCILIATION: 'Сверка', RECOVERY: 'Восстановление' }
const RUN: Record<DemoSyncRun['status'], { label: string; tone: Tone }> = { SUCCEEDED: { label: 'Успешно', tone: 'success' }, FAILED: { label: 'Ошибка', tone: 'danger' }, RUNNING: { label: 'Выполняется', tone: 'info' } }
const ENTITY = { supported: { label: 'Поддерживается', icon: CheckCircle2, cls: 'text-accent-ink' }, partial: { label: 'Частично', icon: MinusCircle, cls: 'text-warning' }, unsupported: { label: 'Недоступно в этой конфигурации', icon: CircleSlash, cls: 'text-muted' } } as const

export function IntegrationsPage() {
  const { organization, isPending: orgPending, error: orgError, refetch } = useActiveOrganization()
  const conns = useConnections(organization?.id)
  const [adding, setAdding] = useState(false)
  const [configuring, setConfiguring] = useState<number | null>(null)
  const [runs, setRuns] = useState<DemoSyncRun[]>(SYNC_HISTORY)
  const [busy, setBusy] = useState(false)
  const canManage = organization?.role === 'OWNER' || organization?.role === 'IT_ADMIN'

  const demoSync = () => {
    setBusy(true)
    const id = `s${Date.now()}`
    setRuns((r) => [{ id, mode: 'INCREMENTAL', status: 'RUNNING', startedAt: new Date().toISOString(), durationSec: 0, received: 0, accepted: 0, rejected: 0, quarantined: 0, note: null }, ...r])
    setTimeout(() => {
      setRuns((r) => r.map((x) => (x.id === id ? { ...x, status: 'SUCCEEDED', durationSec: 38, received: 412, accepted: 412 } : x)))
      setBusy(false)
    }, 2200)
  }

  return (
    <div className="space-y-10">
      <PageHeader demo={false} title="Интеграции 1С" description="Подключения источников. Интеграция работает только на чтение: запись в 1С не выполняется." actions={canManage && <Button size="sm" onClick={() => setAdding(true)}><Plus className="h-4 w-4" aria-hidden />Добавить подключение</Button>} />

      <section aria-labelledby="real" className="space-y-4">
        <h2 id="real" className="text-lg font-medium">Ваши подключения</h2>
        {orgPending ? <LoadingState /> : orgError ? <ErrorState message={describeApiError(orgError)} onRetry={() => void refetch()} /> : !organization ? (
          <EmptyState title="Рабочее пространство ещё не создано" text="Создайте компанию в мастере подключения, затем добавьте источник 1С." action={<Link to="/onboarding" className="text-sm text-accent-ink hover:underline">Открыть мастер</Link>} />
        ) : conns.isPending ? <LoadingState /> : conns.error ? <ErrorState message={describeApiError(conns.error)} onRetry={() => void conns.refetch()} /> : conns.data.length === 0 ? (
          <EmptyState title="Подключений пока нет" text="Добавьте информационную базу 1С. После создания настройте загрузку: серверный коннектор (1С OData или PostgreSQL) или Connector Agent." action={canManage ? <Button size="sm" onClick={() => setAdding(true)}>Добавить подключение</Button> : <p className="text-xs text-muted">Подключения добавляют владелец и IT-администратор.</p>} />
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {conns.data.map((c) => (
              <li key={c.id} className="rounded-[var(--radius-lg)] border border-border bg-surface-1 p-5">
                <div className="flex items-start justify-between gap-3"><h3 className="font-medium">{c.name}</h3><Badge tone={STATUS[c.status].tone}>{STATUS[c.status].label}</Badge></div>
                <dl className="mt-4 grid grid-cols-2 gap-y-2 text-sm">
                  <dt className="text-muted">Конфигурация</dt><dd>{CONFIG_LABEL[c.configuration]}</dd>
                  <dt className="text-muted">Версия</dt><dd>{c.configuration_version ?? '—'}</dd>
                  <dt className="text-muted">СУБД</dt><dd>{DBMS_LABEL[c.source_dbms]}</dd>
                  <dt className="text-muted">Подключение</dt><dd>{TRANSPORT_LABEL[c.transport]}</dd>
                  <dt className="text-muted">Последняя синхронизация</dt><dd>{c.last_successful_sync_at ? formatDateTime(c.last_successful_sync_at) : 'не выполнялась'}</dd>
                </dl>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-muted">Только чтение. {c.connector_kind ? `Серверный коннектор: ${c.connector_kind === 'onec_odata' ? '1С OData' : 'PostgreSQL'}${c.schedule_minutes ? `, каждые ${c.schedule_minutes} мин` : ''}.` : 'Данные загружает серверный коннектор или Connector Agent.'}</p><Button size="sm" variant="secondary" onClick={() => setConfiguring(c.id)}>Загрузка данных</Button></div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="demo" className="space-y-4">
        <div className="flex flex-wrap items-center gap-3"><h2 id="demo" className="text-lg font-medium">Пример работающей интеграции</h2><DemoBadge /></div>
        <DemoNotice>Ниже — демонстрация того, как будет выглядеть подключённый источник: статус, история, покрытие сущностей и предупреждения. Реальная синхронизация с 1С пока не реализована, кнопки меняют только демо-данные.</DemoNotice>
        <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
          <div className="rounded-[var(--radius-lg)] border border-border bg-surface-1 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><h3 className="font-medium">1С:Управление торговлей 11.5 (пример)</h3><p className="mt-1 text-xs text-muted">PostgreSQL · OData · агент v0.0-demo · контакт 2 мин назад · следующая синхронизация в 09:00</p></div>
              <Badge tone="success" icon={CheckCircle2}>Подключено</Badge>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button size="sm" onClick={demoSync} disabled={busy}><RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} aria-hidden />Запустить синхронизацию (демо)</Button>
            </div>
            <div className="mt-5 overflow-x-auto rounded-[var(--radius-md)] border border-border">
              <table className="w-full min-w-[640px] text-sm"><caption className="sr-only">История синхронизаций (демо)</caption>
                <thead className="bg-bg text-xs text-muted"><tr><th className="px-3 py-2 text-left font-medium">Запуск</th><th className="px-3 py-2 text-left font-medium">Режим</th><th className="px-3 py-2 text-left font-medium">Статус</th><th className="px-3 py-2 text-right font-medium">Получено</th><th className="px-3 py-2 text-right font-medium">Принято</th><th className="px-3 py-2 text-right font-medium">Отклонено</th><th className="px-3 py-2 text-right font-medium">Карантин</th></tr></thead>
                <tbody>
                  {runs.map((r) => (
                    <tr key={r.id} className="border-t border-border align-top">
                      <td className="px-3 py-2 text-muted">{formatDateTime(r.startedAt)}</td>
                      <td className="px-3 py-2">{MODE[r.mode]}</td>
                      <td className="px-3 py-2"><Badge tone={RUN[r.status].tone}>{RUN[r.status].label}</Badge>{r.note && <p className="mt-1 max-w-xs text-xs text-muted">{r.note}</p>}{r.status === 'FAILED' && <button type="button" onClick={demoSync} disabled={busy} className="mt-1 text-xs text-accent-ink hover:underline disabled:opacity-50">Повторить (демо)</button>}</td>
                      <td className="tabular px-3 py-2 text-right">{formatNumber(r.received)}</td><td className="tabular px-3 py-2 text-right">{formatNumber(r.accepted)}</td><td className="tabular px-3 py-2 text-right">{formatNumber(r.rejected)}</td><td className="tabular px-3 py-2 text-right">{formatNumber(r.quarantined)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="space-y-4">
            <div className="rounded-[var(--radius-lg)] border border-border bg-surface-1 p-5">
              <h3 className="text-[15px] font-medium">Покрытие сущностей</h3>
              <ul className="mt-3 space-y-2.5">{SYNC_ENTITIES.map((e) => { const s = ENTITY[e.state]; const Icon = s.icon; return <li key={e.name} className="flex items-start gap-2 text-sm"><Icon className={`mt-0.5 h-4 w-4 shrink-0 ${s.cls}`} aria-hidden /><span>{e.name}<span className="block text-xs text-muted">{s.label}</span></span></li> })}</ul>
              <p className="mt-3 text-xs text-muted">Состав данных зависит от конфигурации, версии, публикации, прав и поддержки адаптера.</p>
            </div>
            <div className="rounded-[var(--radius-lg)] border border-border bg-surface-1 p-5">
              <h3 className="text-[15px] font-medium">Предупреждения о качестве</h3>
              <ul className="mt-3 space-y-3">{QUALITY_CHECKS.filter((q) => q.status !== 'VALIDATED').map((q) => <li key={q.label} className="text-sm"><div className="flex items-center justify-between gap-2"><span>{q.label}</span><ValidationBadge status={q.status} /></div><p className="mt-1 text-xs text-muted">{q.detail}</p></li>)}</ul>
            </div>
          </div>
        </div>
      </section>

      <Dialog open={configuring !== null} onClose={() => setConfiguring(null)} title="Загрузка данных" description="Серверный коннектор: только чтение, загрузка в сырой слой хранилища." wide>
        {organization && conns.data?.find((c) => c.id === configuring) && <ConnectorPanel orgId={organization.id} conn={conns.data.find((c) => c.id === configuring)!} canManage={canManage} />}
      </Dialog>
      <Dialog open={adding} onClose={() => setAdding(false)} title="Новое подключение 1С" description="Источник только для чтения." wide>
        {organization && <ConnectionForm organizationId={organization.id} onDone={() => setAdding(false)} />}
      </Dialog>
    </div>
  )
}
