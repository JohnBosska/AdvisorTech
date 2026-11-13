import { apiRequest } from './client'

export interface AuditEvent { id: number; occurred_at: string; user_id: number | null; user_name: string | null; action: string; action_label: string; object_type: string | null; object_id: string | null; details: Record<string, unknown>; request_id: string | null }
export interface AuditAction { action: string; label: string }

export const auditApi = {
  list: (orgId: number, params: { action?: string; before_id?: number; limit?: number }, signal?: AbortSignal) => {
    const q = new URLSearchParams()
    if (params.action) q.set('action', params.action)
    if (params.before_id) q.set('before_id', String(params.before_id))
    if (params.limit) q.set('limit', String(params.limit))
    const qs = q.toString()
    return apiRequest<AuditEvent[]>(`/api/v1/organizations/${orgId}/audit${qs ? `?${qs}` : ''}`, { signal })
  },
  actions: (orgId: number, signal?: AbortSignal) => apiRequest<AuditAction[]>(`/api/v1/organizations/${orgId}/audit/actions`, { signal }),
}
