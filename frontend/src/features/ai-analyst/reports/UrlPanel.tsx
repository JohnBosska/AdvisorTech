import { Link2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { reportsApi, type Dataset } from '../../../lib/api/reports'

const field = 'h-9 w-full rounded-xl border border-white/10 bg-white/[0.04] px-2.5 text-[13px] text-white outline-none transition placeholder:text-white/30 focus:border-[#00e599]/60'

/** Google Sheets, Yandex Disk public links and direct CSV/XLSX URLs. */
export function UrlPanel({ orgId, onLoaded, onError }: { orgId: number; onLoaded: (d: Dataset) => void; onError: (e: unknown) => void }) {
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!url.trim()) return
    setBusy(true)
    try { onLoaded(await reportsApi.fromUrl(orgId, url.trim())) } catch (err) { onError(err) } finally { setBusy(false) }
  }
  return (
    <form onSubmit={(e) => void submit(e)} className="mt-3 space-y-2.5">
      <input aria-label="Ссылка на таблицу" type="url" required placeholder="https://docs.google.com/spreadsheets/d/…" value={url} onChange={(e) => setUrl(e.target.value)} className={field} />
      <button type="submit" disabled={busy || !url.trim()} className="glass-btn w-full justify-center disabled:opacity-40"><Link2 className="h-3.5 w-3.5" aria-hidden />{busy ? 'Загружаю…' : 'Загрузить по ссылке'}</button>
      <p className="text-[11px] leading-relaxed text-white/35">Google Таблицы (доступ «всем, у кого есть ссылка»; берётся лист из ссылки), публичные файлы Яндекс Диска или прямая ссылка на CSV/XLSX. До 5 МБ, данные не сохраняются.</p>
    </form>
  )
}
