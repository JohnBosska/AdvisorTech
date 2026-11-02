import { apiRequest } from './client'

export type MemberRole = 'OWNER' | 'FINANCE' | 'ANALYST' | 'IT_ADMIN'
export type SubscriptionStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'CANCELLED'
export type ConnectionStatus = 'DRAFT' | 'AWAITING_AGENT' | 'CONNECTED' | 'ERROR' | 'REVOKED'

export interface Organization {
  id: number
  name: string
  legal_name: string | null
  tax_id: string | null
  reporting_currency: string
  uses_onec: boolean | null
  role: MemberRole
  subscription: { plan: string; status: SubscriptionStatus; current_period_end: string | null } | null
}

export interface OrganizationCreate {
  name: string
  legal_name?: string | null
  tax_id?: string | null
  uses_onec?: boolean | null
}

export interface SourceConnection {
  id: number
  name: string
  configuration: 'ACCOUNTING' | 'TRADE_MANAGEMENT' | 'ERP' | 'OTHER'
  configuration_version: string | null
  source_dbms: 'POSTGRESQL' | 'MSSQL'
  transport: 'ODATA' | 'HTTP_SERVICE' | 'EXTENSION' | 'FILE_EXCHANGE'
  status: ConnectionStatus
  enabled_entities: string[]
  last_successful_sync_at: string | null
  read_only: boolean
}

export type SourceConnectionCreate = Pick<
  SourceConnection,
  'name' | 'configuration' | 'source_dbms' | 'transport'
> & { configuration_version?: string | null }

export const organizationsApi = {
  list: (signal?: AbortSignal) => apiRequest<Organization[]>('/api/v1/organizations', { signal }),
  create: (body: OrganizationCreate) => apiRequest<Organization>('/api/v1/organizations', { method: 'POST', body }),
  connections: (orgId: number, signal?: AbortSignal) =>
    apiRequest<SourceConnection[]>(`/api/v1/organizations/${orgId}/connections`, { signal }),
  createConnection: (orgId: number, body: SourceConnectionCreate) =>
    apiRequest<SourceConnection>(`/api/v1/organizations/${orgId}/connections`, { method: 'POST', body }),
}
