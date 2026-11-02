import { apiBlob, apiRequest, apiStream } from './client'

export interface AiStatus { configured: boolean; model: string | null; retrieval: 'fulltext' | 'hybrid'; documents: number }
export interface KnowledgeDocument { id: number; title: string; char_count: number; chunk_count: number; vector_indexed: boolean; created_at: string }
export interface Conversation { id: number; title: string; created_at: string }
export interface Source { ref: number; document_id: number; title: string; snippet: string; uploaded_at: string | null }
export type StageStatus = 'idle' | 'running' | 'completed' | 'warning' | 'failed' | 'skipped'
export interface Stage { id: string; status: StageStatus; summary?: string | null; duration_ms?: number | null; count?: number | null }
export interface ChatMessage { id: number; role: 'USER' | 'ASSISTANT'; content: string; sources: Source[]; refusal: boolean; trace: Stage[]; duration_ms: number | null; model: string | null; created_at: string }
export interface Answer { user_message: ChatMessage; assistant_message: ChatMessage }
export type RunEvent =
  | { type: 'stage'; stage: Stage }
  | { type: 'done'; answer: Answer }
  | { type: 'error'; stage: string; message: string; trace: Stage[] }

const base = (orgId: number) => `/api/v1/organizations/${orgId}`

export const aiApi = {
  status: (orgId: number, signal?: AbortSignal) => apiRequest<AiStatus>(`${base(orgId)}/ai/status`, { signal }),
  documents: (orgId: number, signal?: AbortSignal) => apiRequest<KnowledgeDocument[]>(`${base(orgId)}/knowledge/documents`, { signal }),
  addDocument: (orgId: number, body: { title: string; content: string }) =>
    apiRequest<KnowledgeDocument>(`${base(orgId)}/knowledge/documents`, { method: 'POST', body }),
  deleteDocument: (orgId: number, id: number) => apiRequest<void>(`${base(orgId)}/knowledge/documents/${id}`, { method: 'DELETE' }),
  conversations: (orgId: number, signal?: AbortSignal) => apiRequest<Conversation[]>(`${base(orgId)}/chat/conversations`, { signal }),
  createConversation: (orgId: number) => apiRequest<Conversation>(`${base(orgId)}/chat/conversations`, { method: 'POST' }),
  messages: (orgId: number, id: number, signal?: AbortSignal) => apiRequest<ChatMessage[]>(`${base(orgId)}/chat/conversations/${id}/messages`, { signal }),
  stream: (orgId: number, id: number, content: string, onEvent: (e: RunEvent) => void, signal?: AbortSignal) =>
    apiStream(`${base(orgId)}/chat/conversations/${id}/messages/stream`, { content }, (e) => onEvent(e as RunEvent), signal),
  report: (orgId: number, conversationId: number, messageId: number) =>
    apiBlob(`${base(orgId)}/chat/conversations/${conversationId}/messages/${messageId}/report.xlsx`),
  ask: (orgId: number, id: number, content: string) =>
    apiRequest<Answer>(`${base(orgId)}/chat/conversations/${id}/messages`, { method: 'POST', body: { content } }),
}
