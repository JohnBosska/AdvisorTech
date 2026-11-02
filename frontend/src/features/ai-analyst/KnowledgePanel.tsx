import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FileText, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Alert, EmptyState, LoadingState } from '../../components/feedback/Feedback'
import { Button } from '../../components/ui/Button'
import { aiApi } from '../../lib/api/ai'
import { ApiError, describeApiError } from '../../lib/api/client'

const MANAGER_ROLES = ['OWNER', 'FINANCE']

export function KnowledgePanel({ orgId, role }: { orgId: number; role: string }) {
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
    <div>
      <p className="text-xs text-muted">Регламенты, политики, описания показателей. Видны только вашей организации. Форматы: текст и Markdown.</p>
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
    </div>
  )
}
