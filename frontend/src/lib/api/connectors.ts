import { apiRequest } from './client'
import type { ODataSource, PostgresSource } from './reports'

export type ConnectorKind = 'postgres' | 'onec_odata'
export interface CredentialsStatus { kind: ConnectorKind | null; configured: boolean; target: string | null }
export interface ConnectorTable { name: string; label: string; rows: number | null }
export interface ConnectorColumn { name: string; type: 'number' | 'date' | 'text' }
export interface EntityConfig { key: string; cursor: string | null }
export interface SyncRun { id: number; mode: string; status: 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED'; started_at: string | null; finished_at: string | null; records_received: number; records_accepted: number; records_rejected: number; records_quarantined: number; error_summary: string | null }

const base = (orgId: number, cid: number) => `/api/v1/organizations/${orgId}/connections/${cid}/connector`
export const connectorsApi = {
  status: (orgId: number, cid: number, signal?: AbortSignal) => apiRequest<CredentialsStatus>(`${base(orgId, cid)}/credentials`, { signal }),
  setCredentials: (orgId: number, cid: number, body: { kind: ConnectorKind; postgres?: PostgresSource; onec?: ODataSource }) =>
    apiRequest<CredentialsStatus>(`${base(orgId, cid)}/credentials`, { method: 'PUT', body }),
  discover: (orgId: number, cid: number) => apiRequest<ConnectorTable[]>(`${base(orgId, cid)}/discover`, { method: 'POST' }),
  columns: (orgId: number, cid: number, table: string) => apiRequest<ConnectorColumn[]>(`${base(orgId, cid)}/tables/${encodeURIComponent(table)}/columns`),
  configure: (orgId: number, cid: number, entities: Record<string, EntityConfig>, schedule_minutes: number | null) =>
    apiRequest<unknown>(`${base(orgId, cid)}/entities`, { method: 'PUT', body: { entities, schedule_minutes } }),
  sync: (orgId: number, cid: number, mode: 'FULL' | 'INCREMENTAL') => apiRequest<SyncRun>(`${base(orgId, cid)}/sync`, { method: 'POST', body: { mode } }),
  runs: (orgId: number, cid: number, signal?: AbortSignal) => apiRequest<SyncRun[]>(`/api/v1/organizations/${orgId}/connections/${cid}/sync-runs`, { signal }),
}
