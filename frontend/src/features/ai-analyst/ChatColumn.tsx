import { ChevronDown, ChevronRight, Download, FileSpreadsheet, LayoutGrid, MessageSquarePlus, Send, X } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Alert } from '../../components/feedback/Feedback'
import { aiApi, type AiStatus, type ChatMessage, type Conversation, type Source } from '../../lib/api/ai'
import { describeApiError } from '../../lib/api/client'
import { formatDateTime } from '../../lib/format'
import { RUNNING_TEXT, splitBold, splitCitations } from './rag'
import type { LiveRun } from './useAskRun'

const SUGGESTED = ['Какая у нас политика скидок?', 'Как считается валовая маржа?', 'Что делать при нехватке товара на складе?']

function SourceDetails({ source, onClose }: { source: Source; onClose: () => void }) {
  return (
    <div role="dialog" aria-label={`Источник ${source.ref}`} className="mt-2 rounded-[var(--radius-md)] border border-border-strong bg-bg p-3 text-xs">
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium text-text-soft"><span className="font-mono text-accent-ink">[{source.ref}]</span> {source.title}</p>
        <button type="button" aria-label="Закрыть источник" onClick={onClose} className="text-muted hover:text-fg"><X className="h-3.5 w-3.5" /></button>
      </div>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-[11px] text-muted">
        <dt>Тип</dt><dd className="text-text-soft">Документ базы знаний</dd>
        <dt>ID</dt><dd className="text-text-soft">doc-{source.document_id}</dd>
        <dt>Загружен</dt><dd className="text-text-soft">{source.uploaded_at ? formatDateTime(source.uploaded_at) : '—'}</dd>
      </dl>
      <p className="mt-2 whitespace-pre-wrap border-t border-border-subtle pt-2 text-[12px] leading-relaxed text-muted">{source.snippet}…</p>
    </div>
  )
}

function Answer({ m, orgId, conversationId, inspecting, onInspect }: { m: ChatMessage; orgId: number; conversationId: number; inspecting: boolean; onInspect: () => void }) {
  const [open, setOpen] = useState<number | null>(null)
  const [reportError, setReportError] = useState('')
  const [busy, setBusy] = useState(false)
  const validation = m.trace.find((s) => s.id === 'validation')
  const source = m.sources.find((s) => s.ref === open)

  const download = async () => {
    setBusy(true)
    setReportError('')
    try {
      const blob = await aiApi.report(orgId, conversationId, m.id)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `analysis-${m.id}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setReportError(`Не удалось сформировать отчёт. ${describeApiError(e)}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <article className={`space-y-3 rounded-[var(--radius-lg)] border bg-surface-1 p-4 ${m.refusal ? 'border-warning/30' : inspecting ? 'border-accent/40' : 'border-border'}`} data-testid="answer">
      <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-text-soft">
        {splitCitations(m.content).map((part, i) =>
          'text' in part ? <span key={i}>{splitBold(part.text).map((b, j) => b.bold ? <strong key={j} className="font-medium text-fg">{b.text}</strong> : b.text)}</span> : m.sources.some((s) => s.ref === part.ref)
            ? <button key={i} type="button" onClick={() => setOpen(open === part.ref ? null : part.ref)} className="mx-0.5 rounded px-1 font-mono text-[11px] text-accent-ink hover:bg-accent/10">[{part.ref}]</button>
            : <span key={i}>[{part.ref}]</span>)}
      </p>
      {validation && validation.status === 'warning' && <p className="rounded-[var(--radius-md)] border border-warning/30 px-3 py-2 text-xs text-warning">{validation.summary}</p>}
      {validation && validation.status === 'completed' && <p className="font-mono text-[11px] text-accent-ink">✓ {validation.summary}</p>}
      {m.sources.length > 0 && (
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">Источники</p>
          <ul className="mt-1.5 space-y-1">
            {m.sources.map((s) => (
              <li key={s.ref}>
                <button type="button" onClick={() => setOpen(open === s.ref ? null : s.ref)} aria-expanded={open === s.ref} className="w-full truncate rounded px-1 py-0.5 text-left text-xs text-text-soft hover:bg-surface-3">
                  <span className="font-mono text-accent-ink">[{s.ref}]</span> {s.title}
                </button>
              </li>
            ))}
          </ul>
          {source && <SourceDetails source={source} onClose={() => setOpen(null)} />}
        </div>
      )}
      {!m.refusal && (
        <div className="flex items-center gap-3 rounded-[var(--radius-md)] border border-border bg-bg p-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded border border-border-strong text-accent-ink"><FileSpreadsheet className="h-4 w-4" aria-hidden /></span>
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[10px] text-muted">XLSX · 4 листа</p>
            <p className="truncate text-[13px] text-text-soft">Анализ: ответ, источники, трасса</p>
          </div>
          <button type="button" onClick={() => void download()} disabled={busy} className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-border-strong px-2.5 py-1.5 text-xs text-text-soft hover:border-accent hover:text-accent-ink disabled:opacity-50">
            <Download className="h-3.5 w-3.5" aria-hidden />{busy ? 'Готовлю…' : 'Скачать'}
          </button>
        </div>
      )}
      {reportError && <Alert tone="error">{reportError}</Alert>}
      <div className="flex items-center justify-between border-t border-border-subtle pt-2 font-mono text-[10px] text-muted">
        <span>{m.model ? `${m.model} · ` : ''}{m.duration_ms !== null ? `${(m.duration_ms / 1000).toFixed(1)} с` : ''}</span>
        <button type="button" onClick={onInspect} className={inspecting ? 'text-accent-ink' : 'hover:text-fg'}>{inspecting ? '● выполнение показано' : 'Показать выполнение'}</button>
      </div>
    </article>
  )
}

interface Props {
  orgId: number
  orgName: string
  status: AiStatus | undefined
  conversations: Conversation[]
  conversationId: number | null
  onSelectConversation: (id: number | null) => void
  messages: ChatMessage[]
  live: LiveRun | null
  inspectedId: number | null
  onInspect: (id: number) => void
  onSend: (text: string) => void
  onOpenReports: () => void
}

export function ChatColumn({ orgId, orgName, status, conversations, conversationId, onSelectConversation, messages, live, inspectedId, onInspect, onSend, onOpenReports }: Props) {
  const [text, setText] = useState('')
  const [menu, setMenu] = useState(false)
  const end = useRef<HTMLDivElement>(null)
  const sending = live?.running ?? false
  const ready = status?.configured ?? false

  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [messages.length, live?.stages, sending])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const q = text.trim()
    if (!q || sending) return
    setText('')
    onSend(q)
  }
  const progress = live ? Object.values(live.stages).filter((s) => s.status === 'running').map((s) => RUNNING_TEXT[s.id]).filter(Boolean) : []

  return (
    <section aria-label="Чат с AI-аналитиком" className="flex min-h-[70vh] min-w-0 flex-col border-border lg:min-h-0 lg:border-l">
      <header className="relative border-b border-border px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[15px] font-medium">AI-аналитик</h1>
            <p className="truncate text-xs text-muted">Бизнес-аналитика · RAG по документам</p>
            <p className="mt-1 truncate font-mono text-[11px] text-muted">{orgName}</p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <span className={`inline-flex items-center gap-1.5 font-mono text-[11px] ${ready ? 'text-accent-ink' : 'text-warning'}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${ready ? 'bg-accent' : 'bg-warning'}`} />{ready ? 'Подключено' : 'Модель не подключена'}
            </span>
            <button type="button" onClick={() => setMenu((o) => !o)} aria-expanded={menu} aria-haspopup="listbox" className="inline-flex items-center gap-1 rounded-[var(--radius-md)] border border-border px-2 py-1 text-xs text-text-soft hover:border-border-strong">
              Диалоги <ChevronDown className="h-3 w-3" aria-hidden />
            </button>
          </div>
        </div>
        {menu && (
          <ul role="listbox" aria-label="Диалоги" className="absolute right-4 top-[72px] z-10 max-h-72 w-64 overflow-y-auto rounded-[var(--radius-md)] border border-border-strong bg-surface-2 p-1 shadow-xl">
            <li><button type="button" onClick={() => { onSelectConversation(null); setMenu(false) }} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[13px] text-accent-ink hover:bg-surface-3"><MessageSquarePlus className="h-3.5 w-3.5" aria-hidden />Новый диалог</button></li>
            {conversations.map((c) => (
              <li key={c.id}><button type="button" role="option" aria-selected={c.id === conversationId} onClick={() => { onSelectConversation(c.id); setMenu(false) }} className={`w-full truncate rounded px-2 py-1.5 text-left text-[13px] hover:bg-surface-3 ${c.id === conversationId ? 'text-accent-ink' : 'text-text-soft'}`}>{c.title}</button></li>
            ))}
            {conversations.length === 0 && <li className="px-2 py-1.5 text-xs text-muted">Диалогов пока нет</li>}
          </ul>
        )}
      </header>

      <div className="px-4 pt-3">
        <button type="button" onClick={onOpenReports} className="bi-cta flex w-full items-center gap-3 px-3.5 py-3 text-left">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent/15 text-accent-ink"><LayoutGrid className="h-4 w-4" aria-hidden /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13.5px] font-medium text-fg">Создать отчёт через ИИ</span>
            <span className="block truncate text-[11.5px] text-fg/55">BI-конструктор: 1С, PostgreSQL, Google Таблицы, файл → дашборд</span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-fg/50" aria-hidden />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4" aria-live="polite">
        {status && !status.configured && <Alert tone="warning">Модель на сервере не подключена. Документы можно загружать, ответы появятся после настройки ключа.</Alert>}
        {messages.length === 0 && !live && (
          <div className="rounded-[var(--radius-lg)] border border-dashed border-border-strong p-4">
            <p className="text-sm text-muted">Спросите о том, что описано в документах вашей организации:</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {SUGGESTED.map((q) => <button key={q} type="button" disabled={!ready} onClick={() => onSend(q)} className="rounded-full border border-border px-3 py-1.5 text-left text-xs text-text-soft transition-colors hover:border-accent hover:text-accent-ink disabled:opacity-50">{q}</button>)}
            </div>
          </div>
        )}
        {messages.map((m) => m.role === 'USER'
          ? <p key={m.id} className="ml-auto w-fit max-w-[88%] whitespace-pre-wrap rounded-[var(--radius-lg)] border border-border bg-surface-3 px-3.5 py-2 text-[13.5px]">{m.content}</p>
          : <Answer key={m.id} m={m} orgId={orgId} conversationId={conversationId!} inspecting={inspectedId === m.id} onInspect={() => onInspect(m.id)} />)}
        {live && (
          <>
            <p className="ml-auto w-fit max-w-[88%] whitespace-pre-wrap rounded-[var(--radius-lg)] border border-border bg-surface-3 px-3.5 py-2 text-[13.5px]">{live.question}</p>
            {sending && <p role="status" className="font-mono text-[12px] text-muted">{progress[0] ?? 'Запускаю…'}</p>}
            {live.error && <Alert tone="error">{live.error}</Alert>}
          </>
        )}
        <div ref={end} />
      </div>

      <form onSubmit={submit} className="border-t border-border p-3">
        <div className="flex gap-2 rounded-[var(--radius-lg)] border border-border-strong bg-surface-2 p-1.5">
          <label htmlFor="q" className="sr-only">Ваш вопрос</label>
          <input id="q" value={text} maxLength={2000} onChange={(e) => setText(e.target.value)} placeholder="Спросите по вашим документам…" className="h-9 min-w-0 flex-1 bg-transparent px-2.5 text-sm placeholder:text-muted/70" />
          <button type="submit" disabled={!text.trim() || sending} aria-label="Спросить" className="grid h-9 w-9 place-items-center rounded-[var(--radius-md)] bg-accent text-accent-contrast transition-colors hover:bg-accent-strong disabled:opacity-40"><Send className="h-4 w-4" aria-hidden /></button>
        </div>
      </form>
    </section>
  )
}
