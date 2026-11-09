import { useQuery } from '@tanstack/react-query'
import { EmptyState, LoadingState } from '../../components/feedback/Feedback'
import { aiApi } from '../../lib/api/ai'
import { useActiveOrganization } from '../../lib/api/hooks'
import { BiStudio } from './BiStudio'

export function BiPage() {
  const { organization, isLoading } = useActiveOrganization()
  const status = useQuery({ queryKey: ['ai-status', organization?.id], queryFn: ({ signal }) => aiApi.status(organization!.id, signal), enabled: !!organization })
  if (isLoading) return <LoadingState />
  if (!organization) return <div className="p-6"><EmptyState title="Нет организации" text="Создайте организацию в мастере подключения, чтобы строить отчёты." /></div>
  return <BiStudio key={organization.id} orgId={organization.id} aiReady={!!status.data?.configured} mode="page" />
}
