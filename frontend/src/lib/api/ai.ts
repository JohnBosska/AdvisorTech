import { apiRequest } from './client'

export interface AiStatus { configured: boolean; model: string | null; retrieval: 'fulltext' | 'hybrid'; documents: number }
export interface KnowledgeDocument { id: number; title: string; char_count: number; chunk_count: number; vector_indexed: boolean; created_at: string }
export interface Conversation { id: number; title: string; created_at: string }
export interface Source { ref: number; document_id: number; title: string; snippet: string }
export interface ChatMessage { id: number; role: 'USER' | 'ASSISTANT'; content: string; sources: Source[]; refusal: boolean; created_at: string }
export interface Answer { user_message: ChatMessage; assistant_message: ChatMessage }

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
  ask: (orgId: number, id: number, content: string) =>
    apiRequest<Answer>(`${base(orgId)}/chat/conversations/${id}/messages`, { method: 'POST', body: { content } }),
}
