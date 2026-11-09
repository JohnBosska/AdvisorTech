import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { EmptyState, LoadingState } from '../../components/feedback/Feedback'
import { Dialog } from '../../components/ui/Dialog'
import { aiApi } from '../../lib/api/ai'
import { useActiveOrganization } from '../../lib/api/hooks'
import { ChatColumn } from './ChatColumn'
import { KnowledgePanel } from './KnowledgePanel'
import { LeftInfoColumn } from './LeftInfoColumn'
import { PipelineColumn } from './PipelineColumn'
import { BiStudio } from '../bi/BiStudio'
import { useAskRun } from './useAskRun'

function Workspace({ orgId, orgName, role }: { orgId: number; orgName: string; role: string }) {
  const [conversationId, setConversationId] = useState<number | null>(null)
  const [inspected, setInspected] = useState<number | null>(null)
  const [knowledgeOpen, setKnowledgeOpen] = useState(false)
  const [reportsOpen, setReportsOpen] = useState(false)
  const { live, send, reset } = useAskRun(orgId)

  const status = useQuery({ queryKey: ['ai-status', orgId], queryFn: ({ signal }) => aiApi.status(orgId, signal) })
  const conversations = useQuery({ queryKey: ['conversations', orgId], queryFn: ({ signal }) => aiApi.conversations(orgId, signal) })
  const messages = useQuery({
    queryKey: ['messages', orgId, conversationId],
    queryFn: ({ signal }) => aiApi.messages(orgId, conversationId!, signal),
    enabled: conversationId !== null,
  })
  const thread = conversationId === null ? [] : (messages.data ?? [])

  // Which run the centre column shows: the live one, else the inspected answer, else the latest answer.
  const answers = thread.filter((m) => m.role === 'ASSISTANT')
  const shown = answers.find((m) => m.id === inspected) ?? answers[answers.length - 1]
  const stages = live ? live.stages : Object.fromEntries((shown?.trace ?? []).map((s) => [s.id, s]))
  const question = live ? live.question : shown ? (thread[thread.indexOf(shown) - 1]?.content ?? '') : ''

  const ask = async (text: string) => {
    const result = await send(text, conversationId)
    if (result) {
      setConversationId(result.conversationId)
      setInspected(result.answer.assistant_message.id)
    }
  }
  const select = (id: number | null) => { reset(); setConversationId(id); setInspected(null) }

  return (
    <div className="grid min-h-[calc(100dvh-3.5rem)] grid-cols-1 bg-[#050606] lg:h-[calc(100dvh-3.5rem)] lg:grid-cols-[minmax(230px,22fr)_minmax(0,46fr)_minmax(340px,32fr)]">
      <LeftInfoColumn documents={status.data?.documents} onOpenKnowledge={() => setKnowledgeOpen(true)} />
      <div className="order-last flex min-h-0 flex-col lg:order-none">
        <PipelineColumn
          stages={stages}
          started={!!live || !!shown}
          running={live?.running ?? false}
          caption={question}
          durationMs={shown?.duration_ms}
          error={live?.error}
        />
        <button type="button" onClick={() => setKnowledgeOpen(true)} className="mx-4 mb-4 rounded-[var(--radius-md)] border border-border px-3 py-2 text-left text-[13px] text-text-soft hover:border-accent hover:text-accent lg:hidden">
          База знаний{status.data ? ` · ${status.data.documents}` : ''}
        </button>
      </div>
      <ChatColumn
        orgId={orgId}
        orgName={orgName}
        status={status.data}
        conversations={conversations.data ?? []}
        conversationId={conversationId}
        onSelectConversation={select}
        messages={thread}
        live={live}
        inspectedId={shown?.id ?? null}
        onInspect={setInspected}
        onSend={(t) => void ask(t)}
        onOpenReports={() => setReportsOpen(true)}
      />
      {reportsOpen && <BiStudio orgId={orgId} aiReady={!!status.data?.configured} onClose={() => setReportsOpen(false)} />}
      <Dialog open={knowledgeOpen} onClose={() => setKnowledgeOpen(false)} title="База знаний" description="Документы, по которым отвечает AI-аналитик." wide>
        <KnowledgePanel orgId={orgId} role={role} />
      </Dialog>
    </div>
  )
}

export function AiAnalystPage() {
  const { organization, isLoading } = useActiveOrganization()
  if (isLoading) return <LoadingState />
  if (!organization) return <div className="p-6"><EmptyState title="Нет организации" text="Создайте организацию в мастере подключения, чтобы пользоваться AI-аналитиком." /></div>
  return <Workspace key={organization.id} orgId={organization.id} orgName={organization.name} role={organization.role} />
}
