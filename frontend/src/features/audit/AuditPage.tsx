import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Alert, EmptyState, LoadingState } from '../../components/feedback/Feedback'
import { PageHeader } from '../../components/feedback/PageHeader'
import { Button } from '../../components/ui/Button'
import { auditApi, type AuditEvent } from '../../lib/api/audit'
import { describeApiError } from '../../lib/api/client'
import { useActiveOrganization } from '../../lib/api/hooks'
import { formatDateTime } from '../../lib/format'

const PAGE = 50

function Details({ d }: { d: Record<string, unknown> }) {
  const entries = Object.entries(d)
  if (!entries.length) return <span className="text-muted">—</span>
  return <span className="font-mono text-[11px] text-text-soft">{entries.map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`).join(' · ')}</span>
}

export function AuditPage() {
  const { organization, isLoading } = useActiveOrganization()
  const orgId = organization?.id
  const [action, setAction] = useState('')
  const [pages, setPages] = useState<AuditEvent[][]>([])
  const [loadingMore, setLoadingMore] = useState(false)
  const [moreError, setMoreError] = useState('')
  const actions = useQuery({ queryKey: ['audit-actions', orgId], queryFn: ({ signal }) => auditApi.actions(orgId!, signal), enabled: !!orgId })
  const first = useQuery({ queryKey: ['audit', orgId, action], queryFn: ({ signal }) => auditApi.list(orgId!, { action: action || undefined, limit: PAGE }, signal), enabled: !!orgId, retry: false })
  const events = [...(first.data ?? []), ...pages.flat()]
  const canRead = organization && (organization.role === 'OWNER' || organization.role === 'IT_ADMIN')

  const loadMore = async () => {
    if (!orgId || !events.length) return
    setLoadingMore(true); setMoreError('')
    try { setPages((p) => [...p, []]); const next = await auditApi.list(orgId, { action: action || undefined, before_id: events[events.length - 1].id, limit: PAGE }); setPages((p) => [...p.slice(0, -1), next]) } catch (e) { setMoreError(describeApiError(e)); setPages((p) => p.slice(0, -1)) } finally { setLoadingMore(false) }
  }

  if (isLoading) return <LoadingState />
  if (!organization) return <div className="p-6"><EmptyState title="Нет организации" text="Создайте организацию, чтобы просматривать журнал." /></div>
  if (!canRead) return <div className="space-y-4"><PageHeader demo={false} title="Журнал аудита" /><Alert tone="warning">Журнал доступен владельцу организации и IT-администратору.</Alert></div>

  const exhausted = (pages.length ? pages[pages.length - 1] : first.data ?? []).length < PAGE

  return (
    <div className="space-y-5">
      <PageHeader demo={false} title="Журнал аудита" description="Кто и что делал в организации: документы, запросы к ИИ, отчёты, источники, участники, агент. Пароли и токены в журнал не попадают." />
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-muted" htmlFor="audit-action">Действие</label>
        <select id="audit-action" value={action} onChange={(e) => { setAction(e.target.value); setPages([]) }} className="h-9 rounded-[var(--radius-md)] border border-border bg-surface-2 px-2.5 text-sm">
          <option value="">Все действия</option>
          {actions.data?.map((a) => <option key={a.action} value={a.action}>{a.label}</option>)}
        </select>
        <span className="text-xs text-muted">{first.isFetching ? 'Загрузка…' : `Показано: ${events.length}`}</span>
      </div>
      {first.isError && <Alert tone="error">{describeApiError(first.error)}</Alert>}
      {first.isSuccess && events.length === 0 && <EmptyState title="Событий пока нет" text="Журнал наполняется по мере действий участников." />}
      {events.length > 0 && (
        <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-border bg-surface-1">
          <table className="w-full text-[13px]">
            <thead className="text-left text-xs text-muted">
              <tr><th className="px-4 py-2.5 font-normal">Когда</th><th className="px-4 py-2.5 font-normal">Кто</th><th className="px-4 py-2.5 font-normal">Действие</th><th className="px-4 py-2.5 font-normal">Объект</th><th className="px-4 py-2.5 font-normal">Детали</th></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {events.map((e) => (
                <tr key={e.id} className="align-top">
                  <td className="whitespace-nowrap px-4 py-2.5 text-muted">{formatDateTime(e.occurred_at)}</td>
                  <td className="whitespace-nowrap px-4 py-2.5">{e.user_name ?? (e.user_id ? `#${e.user_id}` : 'система')}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-text-soft">{e.action_label}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 font-mono text-[11px] text-muted">{e.object_type ? `${e.object_type}${e.object_id ? ` #${e.object_id}` : ''}` : '—'}</td>
                  <td className="max-w-[420px] px-4 py-2.5"><Details d={e.details} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {moreError && <Alert tone="error">{moreError}</Alert>}
      {events.length > 0 && !exhausted && <Button variant="secondary" size="sm" disabled={loadingMore} onClick={() => void loadMore()}>{loadingMore ? 'Загрузка…' : 'Показать ещё'}</Button>}
    </div>
  )
}
