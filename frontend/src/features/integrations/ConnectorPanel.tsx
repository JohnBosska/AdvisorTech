import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Play, Plug, RefreshCw, Search } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Alert } from '../../components/feedback/Feedback'
import { Button } from '../../components/ui/Button'
import { Field, SelectField } from '../../components/ui/Field'
import { Badge, type Tone } from '../../components/ui/StatusBadge'
import { ApiError, describeApiError } from '../../lib/api/client'
import { connectorsApi, type ConnectorColumn, type ConnectorKind, type ConnectorTable, type EntityConfig, type SyncRun } from '../../lib/api/connectors'
import type { SourceConnection } from '../../lib/api/organizations'
import { formatDateTime, formatNumber } from '../../lib/format'

const RUN: Record<SyncRun['status'], { label: string; tone: Tone }> = { QUEUED: { label: 'В очереди', tone: 'neutral' }, RUNNING: { label: 'Выполняется', tone: 'info' }, SUCCEEDED: { label: 'Успешно', tone: 'success' }, FAILED: { label: 'Ошибка', tone: 'danger' } }
const SCHEDULES = [{ v: '', l: 'Только вручную' }, { v: '15', l: 'Каждые 15 минут' }, { v: '60', l: 'Каждый час' }, { v: '360', l: 'Каждые 6 часов' }, { v: '1440', l: 'Раз в сутки' }]

/** Russian 4xx details come from our API; anything else becomes a generic message. */
function explain(e: unknown): string {
  if (e instanceof ApiError && [400, 403, 409, 503].includes(e.status) && /[а-яё]/i.test(e.message)) return e.message
  return describeApiError(e)
}

function Credentials({ orgId, conn, onSaved }: { orgId: number; conn: SourceConnection; onSaved: () => void }) {
  const [kind, setKind] = useState<ConnectorKind>(conn.transport === 'ODATA' ? 'onec_odata' : 'postgres')
  const [pg, setPg] = useState({ host: '', port: 5432, database: '', user: '', password: '', ssl: true })
  const [od, setOd] = useState({ url: '', user: '', password: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setError('')
    try { await connectorsApi.setCredentials(orgId, conn.id, kind === 'postgres' ? { kind, postgres: pg } : { kind, onec: od }); onSaved() } catch (err) { setError(explain(err)) } finally { setBusy(false) }
  }
  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-3">
      <SelectField label="Тип коннектора" value={kind} onChange={(e) => setKind(e.target.value as ConnectorKind)}>
        <option value="onec_odata">1С через OData (рекомендуется)</option>
        <option value="postgres">PostgreSQL (база 1С или другая)</option>
      </SelectField>
      {kind === 'postgres' ? (
        <>
          <div className="grid grid-cols-[1fr_100px] gap-3">
            <Field label="Хост" required value={pg.host} onChange={(e) => setPg({ ...pg, host: e.target.value })} placeholder="db.company.ru" />
            <Field label="Порт" type="number" value={pg.port} onChange={(e) => setPg({ ...pg, port: Number(e.target.value) || 5432 })} />
          </div>
          <Field label="База данных" required value={pg.database} onChange={(e) => setPg({ ...pg, database: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Пользователь (только чтение)" required value={pg.user} onChange={(e) => setPg({ ...pg, user: e.target.value })} autoComplete="off" />
            <Field label="Пароль" type="password" value={pg.password} onChange={(e) => setPg({ ...pg, password: e.target.value })} autoComplete="new-password" />
          </div>
          <p className="text-xs text-muted">Имена таблиц 1С в SQL технические (`_Document123`): для бизнес-сущностей 1С удобнее OData.</p>
        </>
      ) : (
        <>
          <Field label="Адрес публикации 1С" required value={od.url} onChange={(e) => setOd({ ...od, url: e.target.value })} placeholder="https://1c.company.ru/trade" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Пользователь 1С" value={od.user} onChange={(e) => setOd({ ...od, user: e.target.value })} autoComplete="off" />
            <Field label="Пароль" type="password" value={od.password} onChange={(e) => setOd({ ...od, password: e.target.value })} autoComplete="new-password" />
          </div>
        </>
      )}
      {error && <Alert tone="error">{error}</Alert>}
      <p className="text-xs text-muted">Перед сохранением сервер проверяет соединение. Параметры хранятся зашифрованными и никогда не возвращаются в браузер. Нужен публичный адрес: внутренние адреса запрещены.</p>
      <Button type="submit" size="sm" disabled={busy}><Plug className="h-4 w-4" aria-hidden />{busy ? 'Проверяю…' : 'Проверить и сохранить'}</Button>
    </form>
  )
}

function EntityRow({ orgId, cid, table, cfg, onChange }: { orgId: number; cid: number; table: string; cfg: EntityConfig; onChange: (c: EntityConfig | null) => void }) {
  const cols = useQuery({ queryKey: ['connector-columns', cid, table], queryFn: () => connectorsApi.columns(orgId, cid, table), retry: false })
  const list: ConnectorColumn[] = cols.data ?? []
  return (
    <li className="rounded-[var(--radius-md)] border border-border p-3">
      <div className="flex items-center justify-between gap-2"><span className="truncate text-sm">{table}</span><button type="button" onClick={() => onChange(null)} className="text-xs text-muted hover:text-danger">Убрать</button></div>
      {cols.isError ? <p className="mt-2 text-xs text-danger">{explain(cols.error)}</p> : (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <SelectField label="Ключ записи" value={cfg.key} onChange={(e) => onChange({ ...cfg, key: e.target.value })}>
            {!list.some((c) => c.name === cfg.key) && <option value={cfg.key}>{cfg.key}</option>}
            {list.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
          </SelectField>
          <SelectField label="Курсор (инкремент)" hint="Дата изменения или версия" value={cfg.cursor ?? ''} onChange={(e) => onChange({ ...cfg, cursor: e.target.value || null })}>
            <option value="">Без курсора: полная перезагрузка</option>
            {list.filter((c) => c.type !== 'text').map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
          </SelectField>
        </div>
      )}
    </li>
  )
}

export function ConnectorPanel({ orgId, conn, canManage }: { orgId: number; conn: SourceConnection; canManage: boolean }) {
  const qc = useQueryClient()
  const status = useQuery({ queryKey: ['connector-status', conn.id], queryFn: ({ signal }) => connectorsApi.status(orgId, conn.id, signal) })
  const runs = useQuery({ queryKey: ['sync-runs', conn.id], queryFn: ({ signal }) => connectorsApi.runs(orgId, conn.id, signal), refetchInterval: (q) => (q.state.data?.some((r) => r.status === 'QUEUED' || r.status === 'RUNNING') ? 3000 : false) })
  const [editCreds, setEditCreds] = useState(false)
  const [tables, setTables] = useState<ConnectorTable[] | null>(null)
  const [filter, setFilter] = useState('')
  const [entities, setEntities] = useState<Record<string, EntityConfig>>(conn.entity_config ?? {})
  const [schedule, setSchedule] = useState(conn.schedule_minutes ? String(conn.schedule_minutes) : '')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  const kind = status.data?.kind
  const defaultKey = kind === 'onec_odata' ? 'Ref_Key' : 'id'

  const act = async (name: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(name); setError(''); setNote('')
    try { await fn(); setNote(ok) } catch (e) { setError(explain(e)) } finally { setBusy(null) }
  }
  const refresh = () => { void qc.invalidateQueries({ queryKey: ['connections', orgId] }); void qc.invalidateQueries({ queryKey: ['sync-runs', conn.id] }) }

  if (status.isPending) return <p className="text-sm text-muted">Загрузка…</p>
  if (status.isError) return <Alert tone="error">{explain(status.error)}</Alert>

  if (!status.data.configured || editCreds) {
    return canManage
      ? <Credentials orgId={orgId} conn={conn} onSaved={() => { setEditCreds(false); void status.refetch(); refresh() }} />
      : <Alert tone="warning">Коннектор не настроен. Учётные данные задают владелец и IT-администратор.</Alert>
  }

  const q = filter.trim().toLowerCase()
  const shown = (tables ?? []).filter((t) => !entities[t.name] && (!q || t.label.toLowerCase().includes(q))).slice(0, 100)
  const hasEntities = Object.keys(entities).length > 0

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] border border-border bg-bg px-3 py-2.5 text-sm">
        <span><span className="text-muted">{kind === 'onec_odata' ? '1С OData' : 'PostgreSQL'}:</span> <span className="font-mono text-[13px]">{status.data.target}</span></span>
        {canManage && <button type="button" onClick={() => setEditCreds(true)} className="text-xs text-accent-ink hover:underline">Изменить учётные данные</button>}
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[15px] font-medium">Сущности для загрузки</h3>
          {canManage && <Button size="sm" variant="secondary" disabled={busy !== null} onClick={() => void act('discover', async () => setTables(await connectorsApi.discover(orgId, conn.id)), '')}><Search className="h-4 w-4" aria-hidden />{busy === 'discover' ? 'Читаю схему…' : 'Обзор источника'}</Button>}
        </div>
        {tables && (
          <div className="space-y-2">
            <Field label="Поиск" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={`среди ${tables.length}`} />
            <ul className="max-h-48 space-y-0.5 overflow-y-auto rounded-[var(--radius-md)] border border-border p-1" aria-label="Объекты источника">
              {shown.map((t) => <li key={t.name}><button type="button" onClick={() => setEntities({ ...entities, [t.name]: { key: defaultKey, cursor: null } })} className="flex w-full justify-between gap-2 rounded px-2 py-1 text-left text-[13px] hover:bg-surface-3"><span className="truncate">+ {t.label}</span>{t.rows !== null && <span className="tabular text-xs text-muted">~{formatNumber(t.rows)}</span>}</button></li>)}
              {shown.length === 0 && <li className="px-2 py-1 text-xs text-muted">Ничего не найдено</li>}
            </ul>
          </div>
        )}
        {hasEntities ? (
          <ul className="space-y-2">
            {Object.entries(entities).map(([name, cfg]) => <EntityRow key={name} orgId={orgId} cid={conn.id} table={name} cfg={cfg} onChange={(c) => { const n = { ...entities }; if (c) n[name] = c; else delete n[name]; setEntities(n) }} />)}
          </ul>
        ) : <p className="text-sm text-muted">Сущности не выбраны. Нажмите «Обзор источника» и добавьте нужные таблицы или объекты 1С.</p>}
        {canManage && (
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-56"><SelectField label="Расписание (инкремент)" value={schedule} onChange={(e) => setSchedule(e.target.value)}>{SCHEDULES.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}</SelectField></div>
            <Button size="sm" disabled={busy !== null || !hasEntities} onClick={() => void act('save', async () => { await connectorsApi.configure(orgId, conn.id, entities, schedule ? Number(schedule) : null); refresh() }, 'Настройки сохранены.')}>{busy === 'save' ? 'Сохраняю…' : 'Сохранить настройки'}</Button>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-[15px] font-medium">Синхронизации</h3>
          {canManage && (
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" disabled={busy !== null || !conn.entity_config || !Object.keys(conn.entity_config).length} onClick={() => void act('full', async () => { await connectorsApi.sync(orgId, conn.id, 'FULL'); refresh() }, 'Полная загрузка поставлена в очередь.')}><RefreshCw className="h-4 w-4" aria-hidden />Полная</Button>
              <Button size="sm" disabled={busy !== null || !conn.entity_config || !Object.keys(conn.entity_config).length} onClick={() => void act('inc', async () => { await connectorsApi.sync(orgId, conn.id, 'INCREMENTAL'); refresh() }, 'Инкрементальная загрузка поставлена в очередь.')}><Play className="h-4 w-4" aria-hidden />Загрузить новое</Button>
            </div>
          )}
        </div>
        {error && <Alert tone="error">{error}</Alert>}
        {note && <p role="status" className="text-xs text-muted">{note}</p>}
        {runs.data && runs.data.length > 0 ? (
          <div className="overflow-x-auto rounded-[var(--radius-md)] border border-border">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-bg text-xs text-muted"><tr><th className="px-3 py-2 text-left font-medium">Запуск</th><th className="px-3 py-2 text-left font-medium">Режим</th><th className="px-3 py-2 text-left font-medium">Статус</th><th className="px-3 py-2 text-right font-medium">Получено</th><th className="px-3 py-2 text-right font-medium">Принято</th></tr></thead>
              <tbody>
                {runs.data.map((r) => (
                  <tr key={r.id} className="border-t border-border align-top">
                    <td className="px-3 py-2 text-muted">{r.started_at ? formatDateTime(r.started_at) : '—'}</td>
                    <td className="px-3 py-2">{r.mode === 'FULL' ? 'Полная' : 'Инкремент'}</td>
                    <td className="px-3 py-2"><Badge tone={RUN[r.status].tone}>{RUN[r.status].label}</Badge>{r.error_summary && <p className="mt-1 max-w-xs text-xs text-danger">{r.error_summary}</p>}</td>
                    <td className="tabular px-3 py-2 text-right">{formatNumber(r.records_received)}</td>
                    <td className="tabular px-3 py-2 text-right">{formatNumber(r.records_accepted)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="text-sm text-muted">Синхронизаций ещё не было.</p>}
        <p className="text-xs text-muted">Данные попадают в сырой слой хранилища и доступны в BI-студии во вкладке «Хранилище». За один запуск загружается до 20 000 записей на сущность; инкремент продолжает с последнего значения курсора.</p>
      </section>
    </div>
  )
}
