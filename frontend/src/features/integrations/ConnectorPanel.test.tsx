import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { connectorsApi } from '../../lib/api/connectors'
import type { SourceConnection } from '../../lib/api/organizations'
import { ConnectorPanel } from './ConnectorPanel'

const conn: SourceConnection = { id: 4, name: 'УТ', configuration: 'TRADE_MANAGEMENT', configuration_version: null, source_dbms: 'POSTGRESQL', transport: 'ODATA', status: 'DRAFT', enabled_entities: [], last_successful_sync_at: null, read_only: true }
const wrap = (ui: React.ReactElement) => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>)

afterEach(() => vi.restoreAllMocks())

describe('ConnectorPanel', () => {
  it('stores credentials after a server-side check and never shows the password back', async () => {
    vi.spyOn(connectorsApi, 'runs').mockResolvedValue([])
    const status = vi.spyOn(connectorsApi, 'status').mockResolvedValue({ kind: null, configured: false, target: null })
    const save = vi.spyOn(connectorsApi, 'setCredentials').mockResolvedValue({ kind: 'onec_odata', configured: true, target: 'https://1c.example.com/trade' })
    wrap(<ConnectorPanel orgId={1} conn={conn} canManage />)
    await userEvent.type(await screen.findByLabelText('Адрес публикации 1С'), 'https://1c.example.com/trade')
    await userEvent.type(screen.getByLabelText('Пароль'), 'secret')
    status.mockResolvedValue({ kind: 'onec_odata', configured: true, target: 'https://1c.example.com/trade' })
    await userEvent.click(screen.getByRole('button', { name: /Проверить и сохранить/ }))
    expect(save).toHaveBeenCalledWith(1, 4, { kind: 'onec_odata', onec: { url: 'https://1c.example.com/trade', user: '', password: 'secret' } })
    expect(await screen.findByText('https://1c.example.com/trade')).toBeInTheDocument()
    expect(screen.queryByDisplayValue('secret')).not.toBeInTheDocument()
  })

  it('discovers objects, configures entities with a cursor and a schedule, shows real runs', async () => {
    vi.spyOn(connectorsApi, 'status').mockResolvedValue({ kind: 'onec_odata', configured: true, target: 'https://1c.example.com/trade' })
    vi.spyOn(connectorsApi, 'runs').mockResolvedValue([{ id: 1, mode: 'FULL', status: 'FAILED', started_at: '2026-11-13T10:00:00Z', finished_at: null, records_received: 0, records_accepted: 0, records_rejected: 0, records_quarantined: 0, error_summary: '1С ответила кодом 500' }])
    vi.spyOn(connectorsApi, 'discover').mockResolvedValue([{ name: 'Document_Sale', label: 'Документ: Sale', rows: null }])
    vi.spyOn(connectorsApi, 'columns').mockResolvedValue([{ name: 'Ref_Key', type: 'text' }, { name: 'Date', type: 'date' }])
    const configure = vi.spyOn(connectorsApi, 'configure').mockResolvedValue({})
    wrap(<ConnectorPanel orgId={1} conn={conn} canManage />)
    expect(await screen.findByText('1С ответила кодом 500')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Обзор источника/ }))
    await userEvent.click(await screen.findByRole('button', { name: /Документ: Sale/ }))
    await waitFor(() => expect(screen.getByLabelText('Курсор (инкремент)')).toHaveTextContent('Date'))
    await userEvent.selectOptions(screen.getByLabelText('Курсор (инкремент)'), 'Date')
    await userEvent.selectOptions(screen.getByLabelText('Расписание (инкремент)'), '60')
    await userEvent.click(screen.getByRole('button', { name: /Сохранить настройки/ }))
    expect(configure).toHaveBeenCalledWith(1, 4, { Document_Sale: { key: 'Ref_Key', cursor: 'Date' } }, 60)
  })

  it('tells non-admins who can configure the connector', async () => {
    vi.spyOn(connectorsApi, 'runs').mockResolvedValue([])
    vi.spyOn(connectorsApi, 'status').mockResolvedValue({ kind: null, configured: false, target: null })
    wrap(<ConnectorPanel orgId={1} conn={conn} canManage={false} />)
    expect(await screen.findByText(/задают владелец и IT-администратор/)).toBeInTheDocument()
  })
})
