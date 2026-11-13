import { Database, Plug, Search } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { reportsApi, type Dataset, type SourceRequest, type SourceTable } from '../../../lib/api/reports'

const field = 'h-9 w-full rounded-xl border border-fg/10 bg-fg/[0.04] px-2.5 text-[13px] text-fg outline-none transition placeholder:text-fg/30 focus:border-accent/60'

/** Connects read-only to 1C (OData) or PostgreSQL. Credentials live only in this component's state. */
export function SourcePanel({ orgId, kind, onLoaded, onError }: { orgId: number; kind: 'onec' | 'postgres'; onLoaded: (d: Dataset, label: string) => void; onError: (e: unknown) => void }) {
  const [onec, setOnec] = useState({ url: '', user: '', password: '' })
  const [pg, setPg] = useState({ host: '', port: 5432, database: '', user: '', password: '', ssl: true })
  const [tables, setTables] = useState<SourceTable[] | null>(null)
  const [filter, setFilter] = useState('')
  const [busy, setBusy] = useState<'connect' | string | null>(null)

  const source = (): SourceRequest => (kind === 'onec' ? { kind, onec } : { kind, postgres: pg })

  const connect = async (e: FormEvent) => {
    e.preventDefault()
    setBusy('connect'); setTables(null)
    try { setTables(await reportsApi.tables(orgId, source())) } catch (err) { onError(err) } finally { setBusy(null) }
  }
  const load = async (t: SourceTable) => {
    setBusy(t.name)
    try { onLoaded(await reportsApi.load(orgId, source(), t.name), kind === 'onec' ? `1С: ${t.label}` : `PostgreSQL ${pg.host}/${pg.database}: ${t.label}`) } catch (err) { onError(err) } finally { setBusy(null) }
  }

  const q = filter.trim().toLowerCase()
  const shown = (tables ?? []).filter((t) => !q || t.label.toLowerCase().includes(q) || t.name.toLowerCase().includes(q)).slice(0, 200)

  return (
    <div className="mt-3 space-y-2.5">
      <form onSubmit={(e) => void connect(e)} className="space-y-2">
        {kind === 'onec' ? (
          <>
            <input aria-label="Адрес публикации 1С" required placeholder="https://1c.company.ru/base" value={onec.url} onChange={(e) => setOnec({ ...onec, url: e.target.value })} className={field} />
            <div className="grid grid-cols-2 gap-2">
              <input aria-label="Пользователь 1С" placeholder="Пользователь" value={onec.user} onChange={(e) => setOnec({ ...onec, user: e.target.value })} className={field} autoComplete="off" />
              <input aria-label="Пароль 1С" type="password" placeholder="Пароль" value={onec.password} onChange={(e) => setOnec({ ...onec, password: e.target.value })} className={field} autoComplete="new-password" />
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-[1fr_84px] gap-2">
              <input aria-label="Хост PostgreSQL" required placeholder="db.company.ru" value={pg.host} onChange={(e) => setPg({ ...pg, host: e.target.value })} className={field} />
              <input aria-label="Порт" type="number" min={1} max={65535} value={pg.port} onChange={(e) => setPg({ ...pg, port: Number(e.target.value) || 5432 })} className={field} />
            </div>
            <input aria-label="База данных" required placeholder="База данных" value={pg.database} onChange={(e) => setPg({ ...pg, database: e.target.value })} className={field} />
            <div className="grid grid-cols-2 gap-2">
              <input aria-label="Пользователь PostgreSQL" required placeholder="Пользователь" value={pg.user} onChange={(e) => setPg({ ...pg, user: e.target.value })} className={field} autoComplete="off" />
              <input aria-label="Пароль PostgreSQL" type="password" placeholder="Пароль" value={pg.password} onChange={(e) => setPg({ ...pg, password: e.target.value })} className={field} autoComplete="new-password" />
            </div>
            <label className="flex items-center gap-2 text-[12px] text-fg/55"><input type="checkbox" checked={pg.ssl} onChange={(e) => setPg({ ...pg, ssl: e.target.checked })} className="accent-accent" />Шифрование (SSL), если сервер поддерживает</label>
          </>
        )}
        <button type="submit" disabled={busy !== null} className="glass-btn w-full justify-center disabled:opacity-40"><Plug className="h-3.5 w-3.5" aria-hidden />{busy === 'connect' ? 'Подключаюсь…' : 'Подключиться'}</button>
      </form>

      {tables && (
        <div className="space-y-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-fg/35" aria-hidden />
            <input aria-label="Поиск таблицы" placeholder={`Поиск среди ${tables.length.toLocaleString('ru-RU')}`} value={filter} onChange={(e) => setFilter(e.target.value)} className={`${field} pl-8`} />
          </div>
          <ul className="max-h-56 space-y-0.5 overflow-y-auto pr-1" aria-label={kind === 'onec' ? 'Объекты 1С' : 'Таблицы'}>
            {shown.map((t) => (
              <li key={t.name}>
                <button type="button" disabled={busy !== null} onClick={() => void load(t)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12.5px] text-fg/80 transition hover:bg-fg/[0.06] disabled:opacity-50">
                  <Database className="h-3.5 w-3.5 shrink-0 text-accent-ink/70" aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{t.label}</span>
                  <span className="shrink-0 font-mono text-[10.5px] text-fg/35">{busy === t.name ? 'загрузка…' : t.rows !== null ? `~${t.rows.toLocaleString('ru-RU')}` : ''}</span>
                </button>
              </li>
            ))}
            {shown.length === 0 && <li className="px-2 py-1.5 text-[12px] text-fg/40">Ничего не найдено</li>}
          </ul>
        </div>
      )}
      <p className="text-[11px] leading-relaxed text-fg/35">
        {kind === 'onec'
          ? 'Нужна публикация OData (стандартный интерфейс 1С) на публичном адресе и пользователь с правом чтения. Пароль не сохраняется.'
          : 'Подключение только на чтение, публичный адрес. Подойдёт и база 1С на PostgreSQL. Пароль не сохраняется.'}
        {' '}Берутся первые 5 000 строк.
      </p>
    </div>
  )
}
