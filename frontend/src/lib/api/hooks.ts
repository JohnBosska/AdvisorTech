import { useQuery } from '@tanstack/react-query'
import { organizationsApi } from './organizations'

export function useOrganizations() {
  return useQuery({ queryKey: ['organizations'], queryFn: ({ signal }) => organizationsApi.list(signal), staleTime: 30_000 })
}

/** The active organization: the first one the user belongs to (multi-org switching is not built). */
export function useActiveOrganization() {
  const q = useOrganizations()
  return { ...q, organization: q.data?.[0] ?? null }
}

export function useConnections(orgId: number | undefined) {
  return useQuery({ queryKey: ['connections', orgId], queryFn: ({ signal }) => organizationsApi.connections(orgId!, signal), enabled: orgId !== undefined })
}
