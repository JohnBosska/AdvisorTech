import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FileText, Send, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Alert, EmptyState, LoadingState } from '../../components/feedback/Feedback'
import { PageHeader } from '../../components/feedback/PageHeader'
import { Button } from '../../components/ui/Button'
import { aiApi, type ChatMessage } from '../../lib/api/ai'
import { ApiError, describeApiError } from '../../lib/api/client'
import { useActiveOrganization } from '../../lib/api/hooks'

const MANAGER_ROLES = ['OWNER', 'FINANCE']
const SUGGESTED = ['Какая у нас политика скидок?', 'Как считается валовая маржа?', 'Что делать при нехватке товара на складе?']

function aiError(error: unknown): string {
  if (error instanceof ApiError && error.status === 503) return 'AI-аналитик пока не подключён на сервере: не задан ключ модели.'
  if (error instanceof ApiError && error.status === 429) return 'Слишком много вопросов подряд. Подождите немного.'
  return describeApiError(error)
}

function Bubble({ m }: { m: ChatMessage }) {
  if (m.role === 'USER') {
    return <p className="ml-auto w-fit max-w-[85%] whitespace-pre-wrap rounded-[var(--radius-lg)] border border-border bg-surface-3 px-4 py-2.5 text-sm">{m.content}</p>
  }
  return (
    <article className={`space-y-3 rounded-[var(--radius-lg)] border bg-surface-1 p-5 ${m.refusal ? 'border-warning/30' : 'border-border'}`}>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-text-soft">{m.content}</p>
      {m.sources.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-accent">Источники ({m.sources.length})</summary>
          <ul className="mt-2 space-y-2">
            {m.sources.map((s) => (
              <li key={s.ref} className="rounded-[var(--radius-md)] border border-border bg-black p-3">
                <p><span className="font-mono text-[11px] text-cyan">[{s.ref}]</span> {s.title}</p>
                <p className="mt-1 whitespace-pre-wrap text-xs text-muted">{s.snippet}…</p>
              </li>
            ))}
          </ul>
        </details>
      )}
      <p className="text-xs text-muted">Ответ основан только на загруженных документах. Данные из 1С сюда пока не передаются. Решение принимает собственник.</p>
    </article>
  )
}

function Chat({ orgId, ready }: { orgId: number; ready: boolean }) {
  const qc = useQueryClient()
  const [conversationId, setConversationId] = useState<number | null>(null)
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const end = useRef<HTMLDivElement>(null)

  const conversations = useQuery({ queryKey: ['conversations', orgId], queryFn: ({ signal }) => aiApi.conversations(orgId, signal) })
  const messages = useQuery({
    queryKey: ['messages', orgId, conversationId],
    queryFn: ({ signal }) => aiApi.messages(orgId, conversationId!, signal),
    enabled: conversationId !== null,
  })

  const ask = useMutation({
    mutationFn: async (question: string) => {
      const id = conversationId ?? (await aiApi.createConversation(orgId)).id
      setConversationId(id)
      return { id, answer: await aiApi.ask(orgId, id, question) }
    },
    onSuccess: ({ id }) => {
      setText('')
      setError('')
      void qc.invalidateQueries({ queryKey: ['messages', orgId, id] })
      void qc.invalidateQueries({ queryKey: ['conversations', orgId] })
    },
    onError: (e) => setError(aiError(e)),
  })

  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [messages.data, ask.isPending])

  const submit = (e: FormEvent) => { e.preventDefault(); const q = text.trim(); if (q && !ask.isPending) ask.mutate(q) }
  const thread = messages.data ?? []

  return (
    <section aria-label="Чат с AI-аналитиком">
      {(conversations.data?.length ?? 0) > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
          <button type="button" onClick={() => { setConversationId(null); setError('') }} className={`rounded-full border px-3 py-1 ${conversationId === null ? 'border-accent text-accent' : 'border-border text-muted hover:text-white'}`}>Новый диалог</button>
          {conversations.data!.slice(0, 6).map((c) => (
            <button key={c.id} type="button" onClick={() => { setConversationId(c.id); setError('') }} className={`max-w-[200px] truncate rounded-full border px-3 py-1 ${conversationId === c.id ? 'border-accent text-accent' : 'border-border text-muted hover:text-white'}`}>{c.title}</button>
          ))}
        </div>
      )}
      <div className="space-y-5" aria-live="polite">
        {thread.length === 0 && !ask.isPending && (
          <div className="rounded-[var(--radius-lg)] border border-dashed border-border-strong p-6">
            <p className="text-sm text-muted">Спросите о том, что описано в ваших документах:</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {SUGGESTED.map((q) => <button key={q} type="button" disabled={!ready} onClick={() => ask.mutate(q)} className="rounded-full border border-border px-3 py-1.5 text-left text-[13px] text-text-soft transition-colors hover:border-accent hover:text-accent disabled:opacity-50">{q}</button>)}
            </div>
          </div>
        )}
        {thread.map((m) => <Bubble key={m.id} m={m} />)}
        {ask.isPending && <p role="status" className="font-mono text-xs text-muted">Ищу в документах…</p>}
        {error && <Alert tone="error">{error}</Alert>}
        <div ref={end} />
      </div>
      <form onSubmit={submit} className="sticky bottom-4 mt-6 flex gap-2 rounded-[var(--radius-lg)] border border-border-strong bg-surface-2/95 p-2 backdrop-blur">
        <label htmlFor="q" className="sr-only">Ваш вопрос</label>
        <input id="q" value={text} maxLength={2000} onChange={(e) => setText(e.target.value)} placeholder="Спросите по вашим документам…" className="h-10 flex-1 bg-transparent px-3 text-sm placeholder:text-muted/70" />
        <Button type="submit" disabled={!text.trim() || ask.isPending}><Send className="h-4 w-4" aria-hidden />Спросить</Button>
      </form>
    </section>
  )
}

function Knowledge({ orgId, role }: { orgId: number; role: string }) {
  const qc = useQueryClient()
  const canManage = MANAGER_ROLES.includes(role)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [error, setError] = useState('')
  const docs = useQuery({ queryKey: ['documents', orgId], queryFn: ({ signal }) => aiApi.documents(orgId, signal) })
  const refresh = () => { void qc.invalidateQueries({ queryKey: ['documents', orgId] }); void qc.invalidateQueries({ queryKey: ['ai-status', orgId] }) }

  const add = useMutation({
    mutationFn: () => aiApi.addDocument(orgId, { title: title.trim(), content }),
    onSuccess: () => { setTitle(''); setContent(''); setError(''); refresh() },
    onError: (e) => setError(e instanceof ApiError && e.status === 409 ? 'Такой документ уже загружен.' : e instanceof ApiError && e.status === 400 ? 'Документ пустой или слишком длинный.' : describeApiError(e)),
  })
  const remove = useMutation({ mutationFn: (id: number) => aiApi.deleteDocument(orgId, id), onSuccess: refresh })

  const onFile = async (file: File | undefined) => {
    if (!file) return
    setContent(await file.text())
    if (!title) setTitle(file.name.replace(/\.[^.]+$/, ''))
  }

  return (
    <section aria-label="База знаний" className="rounded-[var(--radius-lg)] border border-border bg-surface-1 p-5">
      <h2 className="text-sm font-medium">База знаний</h2>
      <p className="mt-1 text-xs text-muted">Документы вашей организации: регламенты, политики, описания показателей. Видны только вашей организации. Форматы: текст и Markdown.</p>
      {docs.isLoading && <LoadingState />}
      {docs.data && docs.data.length === 0 && <div className="mt-4"><EmptyState title="Документов пока нет" text="Добавьте первый документ, чтобы AI мог отвечать по нему." /></div>}
      <ul className="mt-4 space-y-2">
        {docs.data?.map((d) => (
          <li key={d.id} className="flex items-center gap-3 rounded-[var(--radius-md)] border border-border bg-black px-3 py-2 text-sm">
            <FileText className="h-4 w-4 shrink-0 text-muted" aria-hidden />
            <span className="min-w-0 flex-1 truncate">{d.title}</span>
            <span className="shrink-0 font-mono text-[11px] text-muted">{d.chunk_count} фр.{d.vector_indexed ? ' · векторы' : ''}</span>
            {canManage && <button type="button" aria-label={`Удалить документ ${d.title}`} onClick={() => remove.mutate(d.id)} className="text-muted hover:text-danger"><Trash2 className="h-4 w-4" /></button>}
          </li>
        ))}
      </ul>
      {canManage ? (
        <form onSubmit={(e) => { e.preventDefault(); add.mutate() }} className="mt-5 space-y-3">
          <label className="block text-xs text-muted">Название
            <input value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} className="mt-1 h-9 w-full rounded-[var(--radius-md)] border border-border bg-black px-3 text-sm text-white" />
          </label>
          <label className="block text-xs text-muted">Текст документа
            <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={6} className="mt-1 w-full rounded-[var(--radius-md)] border border-border bg-black p-3 text-sm text-white" />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <label className="cursor-pointer text-xs text-accent hover:underline">Загрузить .txt / .md
              <input type="file" accept=".txt,.md,text/plain,text/markdown" className="sr-only" onChange={(e) => void onFile(e.target.files?.[0])} />
            </label>
            <Button type="submit" size="sm" disabled={!title.trim() || !content.trim() || add.isPending}>Добавить</Button>
          </div>
          {error && <Alert tone="error">{error}</Alert>}
        </form>
      ) : <p className="mt-4 text-xs text-muted">Добавлять документы могут владелец и финансовый специалист.</p>}
    </section>
  )
}

export function AiAnalystPage() {
  const { organization, isLoading } = useActiveOrganization()
  const status = useQuery({ queryKey: ['ai-status', organization?.id], queryFn: ({ signal }) => aiApi.status(organization!.id, signal), enabled: !!organization })

  if (isLoading) return <LoadingState />
  if (!organization) return <EmptyState title="Нет организации" text="Создайте организацию в мастере подключения, чтобы пользоваться AI-аналитиком." />

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="AI-аналитик" description="Вопросы на обычном языке — ответы по документам вашей организации со ссылками на источники." />
      {status.data && !status.data.configured && <Alert tone="warning">Модель на сервере пока не подключена: документы можно загружать, но отвечать AI начнёт после настройки ключа.</Alert>}
      <Alert tone="info">Сейчас AI отвечает только по загруженным документам. Расчёты по данным 1С (маржа, остатки, логистика) появятся после подключения хранилища данных: числа AI не придумывает.{status.data ? ` Поиск: ${status.data.retrieval === 'hybrid' ? 'по смыслу и словам' : 'по словам'}.` : ''}</Alert>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
        <Chat orgId={organization.id} ready={status.data?.configured ?? false} />
        <Knowledge orgId={organization.id} role={organization.role} />
      </div>
    </div>
  )
}
