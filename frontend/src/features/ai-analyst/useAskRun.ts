import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { aiApi, type Answer, type ChatMessage, type RunEvent, type Stage } from '../../lib/api/ai'
import { ApiError, describeApiError } from '../../lib/api/client'

export interface LiveRun {
  question: string
  stages: Record<string, Stage>
  running: boolean
  error: string | null
}

export function aiErrorText(error: unknown): string {
  if (error instanceof ApiError && error.status === 503) return 'AI-аналитик не подключён на сервере или модель временно недоступна.'
  if (error instanceof ApiError && error.status === 429) return 'Слишком много вопросов подряд. Подождите немного.'
  if (error instanceof ApiError && error.status === 400) return 'Вопрос слишком длинный или пустой.'
  return describeApiError(error)
}

/** Sends a question over SSE and exposes the stages as they really happen on the server. */
export function useAskRun(orgId: number) {
  const qc = useQueryClient()
  const [live, setLive] = useState<LiveRun | null>(null)
  const abort = useRef<AbortController | null>(null)

  useEffect(() => () => abort.current?.abort(), [])

  const send = useCallback(
    async (question: string, conversationId: number | null): Promise<{ conversationId: number; answer: Answer } | null> => {
      abort.current?.abort()
      const controller = new AbortController()
      abort.current = controller
      setLive({ question, stages: {}, running: true, error: null })
      try {
        const id = conversationId ?? (await aiApi.createConversation(orgId)).id
        let answer: Answer | null = null
        let failure: string | null = null
        await aiApi.stream(orgId, id, question, (event: RunEvent) => {
          if (event.type === 'stage') {
            setLive((l) => (l ? { ...l, stages: { ...l.stages, [event.stage.id]: event.stage } } : l))
          } else if (event.type === 'error') {
            failure = event.message
            setLive((l) => (l ? { ...l, stages: Object.fromEntries(event.trace.map((s) => [s.id, s])), error: aiErrorText(new ApiError(503, event.message)) } : l))
          } else {
            answer = event.answer
          }
        }, controller.signal)
        if (failure || !answer) {
          setLive((l) => (l ? { ...l, running: false, error: l.error ?? 'Ответ не получен.' } : l))
          return null
        }
        const done: Answer = answer
        qc.setQueryData<ChatMessage[]>(['messages', orgId, id], (old) => [...(old ?? []), done.user_message, done.assistant_message])
        void qc.invalidateQueries({ queryKey: ['conversations', orgId] })
        setLive(null)
        return { conversationId: id, answer: done }
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return null
        setLive((l) => (l ? { ...l, running: false, error: aiErrorText(error) } : l))
        return null
      }
    },
    [orgId, qc],
  )

  return { live, send, reset: () => setLive(null) }
}
