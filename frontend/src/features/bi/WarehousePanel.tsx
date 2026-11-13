import { useQuery } from '@tanstack/react-query'
import { Database, RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { reportsApi, type Dataset, type WarehouseEntity } from '../../lib/api/reports'

/** Entities Connector Agents delivered into the raw warehouse layer. No credentials needed. */
export function WarehousePanel({ orgId, onLoaded, onError }: { orgId: number; onLoaded: (d: Dataset, e: WarehouseEntity) => void; onError: (e: unknown) => void }) {
  const [busy, setBusy] = useState<string | null>(null)
  const query = useQuery({ queryKey: ['warehouse-entities', orgId], queryFn: () => reportsApi.warehouseEntities(orgId), retry: false })
  const items = query.isError ? [] : query.data ?? null
  useEffect(() => { if (query.error) onError(query.error) }, [query.error, onError])
  const load = () => void query.refetch()
  const pick = async (e: WarehouseEntity) => {
    const key = `${e.connection_id}:${e.entity}`
    setBusy(key)
    try { onLoaded(await reportsApi.warehouseLoad(orgId, e.connection_id, e.entity), e) } catch (err) { onError(err) } finally { setBusy(null) }
  }
  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center justify-between text-[11.5px] text-fg/45">
        <span>{items ? `Сущностей: ${items.length}` : 'Загрузка…'}</span>
        <button type="button" aria-label="Обновить список" onClick={load} className="text-fg/50 hover:text-fg"><RefreshCw className="h-3.5 w-3.5" /></button>
      </div>
      {items?.length === 0 && <p className="text-[12px] leading-relaxed text-fg/45">Хранилище пусто. Данные появятся, когда Connector Agent на вашем сервере 1С передаст записи. Пока можно использовать файл, ссылку, 1С OData или PostgreSQL.</p>}
      <ul className="max-h-64 space-y-0.5 overflow-y-auto pr-1" aria-label="Сущности хранилища">
        {items?.map((e) => {
          const key = `${e.connection_id}:${e.entity}`
          return (
            <li key={key}>
              <button type="button" disabled={busy !== null} onClick={() => void pick(e)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12.5px] text-fg/80 transition hover:bg-fg/[0.06] disabled:opacity-50">
                <Database className="h-3.5 w-3.5 shrink-0 text-accent-ink/70" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{e.entity}</span>
                  <span className="block truncate text-[10.5px] text-fg/40">{e.connection_name}{e.last_ingested_at ? ` · ${new Date(e.last_ingested_at).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })}` : ''}</span>
                </span>
                <span className="shrink-0 font-mono text-[10.5px] text-fg/35">{busy === key ? 'загрузка…' : e.records.toLocaleString('ru-RU')}</span>
              </button>
            </li>
          )
        })}
      </ul>
      <p className="text-[11px] leading-relaxed text-fg/35">Сырой слой: записи так, как их передал агент (только чтение). Берутся первые 5 000 записей; отчёт на этих данных обновляется одной кнопкой.</p>
    </div>
  )
}
