import { apiRequest } from './client'
import type { Dataset } from './reports'

export interface SavedSource { kind: 'file' | 'url' | 'onec' | 'postgres' | 'none'; label: string; url?: string | null }
export interface BiReportSummary { id: number; title: string; source: SavedSource; created_by: number | null; updated_at: string }
export interface BiReport<TSpec = unknown> extends BiReportSummary { spec: TSpec; dataset: Dataset | null }
export interface BiReportWrite<TSpec = unknown> { title: string; spec: TSpec; dataset: Dataset | null; source: SavedSource }

const base = (orgId: number) => `/api/v1/organizations/${orgId}/bi/reports`
export const biApi = {
  list: (orgId: number) => apiRequest<BiReportSummary[]>(base(orgId)),
  get: <T,>(orgId: number, id: number) => apiRequest<BiReport<T>>(`${base(orgId)}/${id}`),
  create: <T,>(orgId: number, body: BiReportWrite<T>) => apiRequest<BiReport<T>>(base(orgId), { method: 'POST', body }),
  update: <T,>(orgId: number, id: number, body: BiReportWrite<T>) => apiRequest<BiReport<T>>(`${base(orgId)}/${id}`, { method: 'PUT', body }),
  remove: (orgId: number, id: number) => apiRequest<void>(`${base(orgId)}/${id}`, { method: 'DELETE' }),
  refresh: <T,>(orgId: number, id: number) => apiRequest<BiReport<T>>(`${base(orgId)}/${id}/refresh`, { method: 'POST' }),
}
