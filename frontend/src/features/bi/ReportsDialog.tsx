import { FolderOpen, Trash2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { biApi, type BiReportSummary } from '../../lib/api/bi'

export function ReportsDialog({ orgId, onOpen, onClose, onError }: { orgId: number; onOpen: (id: number) => void; onClose: () => void; onError: (e: unknown) => void }) {
  const [items, setItems] = useState<BiReportSummary[] | null>(null)
  useEffect(() => { biApi.list(orgId).then(setItems).catch((e) => { onError(e); setItems([]) }) }, [orgId, onError])
  const remove = async (id: number) => {
    try { await biApi.remove(orgId, id); setItems((xs) => (xs ?? []).filter((x) => x.id !== id)) } catch (e) { onError(e) }
  }
  return (
    <div className="absolute inset-0 z-40 grid place-items-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="Сохранённые отчёты" onClick={onClose}>
      <div className="glass w-full max-w-lg p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <p className="text-[15px] font-medium text-white">Сохранённые отчёты</p>
          <button type="button" aria-label="Закрыть" onClick={onClose} className="text-white/60 hover:text-white"><X className="h-4 w-4" /></button>
        </div>
        <ul className="mt-3 max-h-[60vh] space-y-1 overflow-auto">
          {items === null && <li className="py-4 text-center text-[13px] text-white/50">Загрузка…</li>}
          {items?.length === 0 && <li className="py-4 text-center text-[13px] text-white/50">Пока нет сохранённых отчётов</li>}
          {items?.map((r) => (
            <li key={r.id} className="flex items-center gap-2 rounded-xl px-2 py-2 hover:bg-white/[0.05]">
              <button type="button" onClick={() => onOpen(r.id)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
                <FolderOpen className="h-4 w-4 shrink-0 text-[#00e599]" aria-hidden />
                <span className="min-w-0">
                  <span className="block truncate text-[13.5px] text-white">{r.title}</span>
                  <span className="block truncate text-[11.5px] text-white/45">{r.source.label || 'без данных'} · {new Date(r.updated_at).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })}</span>
                </span>
              </button>
              <button type="button" aria-label={`Удалить «${r.title}»`} onClick={() => void remove(r.id)} className="text-white/40 hover:text-[#f3a29f]"><Trash2 className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
