import { apiRequest, apiUpload } from './client'

export type ColumnType = 'number' | 'text' | 'date'
export type WidgetType = 'kpi' | 'bar' | 'line' | 'pie' | 'table'
export type Aggregation = 'sum' | 'avg' | 'count' | 'min' | 'max'
export interface DatasetColumn { name: string; type: ColumnType; samples: string[] }
export type Row = Record<string, string | number | null>
export interface Dataset { filename: string; columns: DatasetColumn[]; rows: Row[]; total_rows: number | null; truncated: boolean }
export interface Widget { type: WidgetType; title: string; x: string | null; y: string | null; agg: Aggregation; limit: number }
export interface ReportPlan { title: string; widgets: Widget[]; model: string; dropped: number }

export interface PostgresSource { host: string; port: number; database: string; user: string; password: string; ssl: boolean }
export interface ODataSource { url: string; user: string; password: string }
export type SourceRequest = { kind: 'postgres'; postgres: PostgresSource } | { kind: 'onec'; onec: ODataSource }
export interface SourceTable { name: string; label: string; rows: number | null }

export interface WarehouseEntity { connection_id: number; connection_name: string; entity: string; records: number; last_ingested_at: string | null }

export const reportsApi = {
  warehouseEntities: (orgId: number) => apiRequest<WarehouseEntity[]>(`/api/v1/organizations/${orgId}/warehouse/entities`),
  warehouseLoad: (orgId: number, connectionId: number, entity: string) =>
    apiRequest<Dataset>(`/api/v1/organizations/${orgId}/warehouse/entities/${encodeURIComponent(entity)}/dataset?connection_id=${connectionId}`),
  upload: (orgId: number, file: File) => apiUpload<Dataset>(`/api/v1/organizations/${orgId}/reports/dataset?filename=${encodeURIComponent(file.name)}`, file),
  plan: (orgId: number, request: string, columns: DatasetColumn[]) =>
    apiRequest<ReportPlan>(`/api/v1/organizations/${orgId}/reports/plan`, { method: 'POST', body: { request, columns } }),
  fromUrl: (orgId: number, url: string) => apiRequest<Dataset>(`/api/v1/organizations/${orgId}/reports/sources/url`, { method: 'POST', body: { url } }),
  tables: (orgId: number, source: SourceRequest) => apiRequest<SourceTable[]>(`/api/v1/organizations/${orgId}/reports/sources/tables`, { method: 'POST', body: source }),
  load: (orgId: number, source: SourceRequest, table: string) =>
    apiRequest<Dataset>(`/api/v1/organizations/${orgId}/reports/sources/load`, { method: 'POST', body: { ...source, table } }),
}
