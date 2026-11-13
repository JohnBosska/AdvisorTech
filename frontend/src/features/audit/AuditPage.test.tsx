import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { auditApi } from '../../lib/api/audit'
import * as hooks from '../../lib/api/hooks'
import { AuditPage } from './AuditPage'

const org = (role: string) => ({ organization: { id: 1, name: 'Org', role } as never, isLoading: false, isPending: false }) as never
const wrap = (ui: React.ReactElement) => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>)

afterEach(() => vi.restoreAllMocks())

describe('AuditPage', () => {
  it('hides the journal from analysts', () => {
    vi.spyOn(hooks, 'useActiveOrganization').mockReturnValue(org('ANALYST'))
    wrap(<AuditPage />)
    expect(screen.getByText(/доступен владельцу/)).toBeInTheDocument()
  })

  it('lists events for the owner and filters by action', async () => {
    vi.spyOn(hooks, 'useActiveOrganization').mockReturnValue(org('OWNER'))
    vi.spyOn(auditApi, 'actions').mockResolvedValue([{ action: 'ai.chat', label: 'Вопрос AI-аналитику' }])
    const list = vi.spyOn(auditApi, 'list').mockResolvedValue([{ id: 5, occurred_at: '2026-11-13T10:00:00Z', user_id: 2, user_name: 'Иван', action: 'ai.chat', action_label: 'Вопрос AI-аналитику', object_type: 'chat_message', object_id: '9', details: { sources: 1 }, request_id: 'r' }])
    wrap(<AuditPage />)
    expect(await screen.findByText('Иван')).toBeInTheDocument()
    expect(screen.getByText('sources: 1')).toBeInTheDocument()
    await userEvent.selectOptions(await screen.findByLabelText('Действие'), 'ai.chat')
    expect(list).toHaveBeenLastCalledWith(1, { action: 'ai.chat', limit: 50 }, expect.anything())
  })
})
