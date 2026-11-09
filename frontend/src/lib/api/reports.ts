import { apiRequest, apiUpload } from './client'

export type ColumnType = 'number' | 'text' | 'date'
export type WidgetType = 'kpi' | 'bar' | 'line' | 'pie' | 'table'
export type Aggregation = 'sum' | 'avg' | 'count' | 'min' | 'max'
export interface DatasetColumn { name: string; type: ColumnType; samples: string[] }
export type Row = Record<string, string | number | null>
export interface Dataset { filename: string; columns: DatasetColumn[]; rows: Row[]; total_rows: number; truncated: boolean }
export interface Widget { type: WidgetType; title: string; x: string | null; y: string | null; agg: Aggregation; limit: number }
export interface ReportPlan { title: string; widgets: Widget[]; model: string; dropped: number }

export const reportsApi = {
  upload: (orgId: number, file: File) => apiUpload<Dataset>(`/api/v1/organizations/${orgId}/reports/dataset?filename=${encodeURIComponent(file.name)}`, file),
  plan: (orgId: number, request: string, columns: DatasetColumn[]) =>
    apiRequest<ReportPlan>(`/api/v1/organizations/${orgId}/reports/plan`, { method: 'POST', body: { request, columns } }),
}
