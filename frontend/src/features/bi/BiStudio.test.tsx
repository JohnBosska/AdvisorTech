import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render as rtlRender, screen, waitFor, within } from '@testing-library/react'
import type { ReactElement } from 'react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { biApi } from '../../lib/api/bi'
import { reportsApi } from '../../lib/api/reports'
import { BiStudio, planToVisuals } from './BiStudio'
import { newPage } from './types'

const dataset = {
  filename: 'sales.csv', total_rows: 3, truncated: false,
  columns: [{ name: 'Группа', type: 'text' as const, samples: [] }, { name: 'Выручка', type: 'number' as const, samples: [] }],
  rows: [{ Группа: 'A', Выручка: 1000000 }, { Группа: 'B', Выручка: 2500000 }, { Группа: 'A', Выручка: 500000 }],
}

async function withData() {
  vi.spyOn(reportsApi, 'upload').mockResolvedValue(dataset)
  render(<BiStudio orgId={1} aiReady={false} />)
  await userEvent.click(screen.getByRole('tab', { name: 'Файл' }))
  fireEvent.change(screen.getByLabelText('Файл с данными'), { target: { files: [new File(['x'], 'sales.csv')] } })
  await screen.findByRole('list', { name: 'Поля данных' })
}

const render = (ui: ReactElement) => rtlRender(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>)

afterEach(() => vi.restoreAllMocks())

describe('BiStudio', () => {
  it('adds a card with smart fields, reformats it and undoes a delete', async () => {
    await withData()
    const palette = screen.getByText('Добавить визуал').parentElement!
    await userEvent.click(within(palette).getByRole('button', { name: /Карточка/ }))
    expect(await screen.findByText('4 млн')).toBeInTheDocument() // auto format is compact

    await userEvent.click(screen.getByRole('tab', { name: 'Формат' }))
    await userEvent.selectOptions(screen.getByLabelText('Формат чисел'), 'int')
    expect(screen.getByText('4 000 000')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Удалить визуал' }))
    expect(screen.queryByText('4 000 000')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Отменить/ }))
    expect(screen.getByText('4 000 000')).toBeInTheDocument()
  })

  it('applies a page filter to the visuals', async () => {
    await withData()
    const palette = screen.getByText('Добавить визуал').parentElement!
    await userEvent.click(within(palette).getByRole('button', { name: /Карточка/ }))
    await userEvent.click(screen.getByRole('tab', { name: 'Фильтры' }))
    await userEvent.click(screen.getAllByRole('button', { name: /Добавить фильтр/ })[0])
    await userEvent.selectOptions(screen.getByLabelText('Поле фильтра'), 'Группа')
    await userEvent.click(screen.getByRole('checkbox', { name: 'A' }))
    expect(await screen.findByText('1,5 млн')).toBeInTheDocument()
  })

  it('saves the report with its spec, data snapshot and source', async () => {
    const create = vi.spyOn(biApi, 'create').mockResolvedValue({ id: 7, title: 'sales', source: { kind: 'file', label: 'sales.csv' }, created_by: 1, updated_at: '', spec: {}, dataset })
    await withData()
    await userEvent.click(screen.getByRole('button', { name: /Сохранить/ }))
    await waitFor(() => expect(create).toHaveBeenCalled())
    const body = create.mock.calls[0][1]
    expect(body.title).toBe('sales')
    expect(body.dataset).toEqual(dataset)
    expect(body.source).toEqual({ kind: 'file', label: 'sales.csv' })
    expect(await screen.findByText(/сохранено/)).toBeInTheDocument()
  })
})

describe('BiStudio data sources', () => {
  it('loads a Google Sheet by link and remembers the link as the source', async () => {
    const fromUrl = vi.spyOn(reportsApi, 'fromUrl').mockResolvedValue({ ...dataset, filename: 'Продажи.csv' })
    const create = vi.spyOn(biApi, 'create').mockResolvedValue({ id: 1, title: 't', source: { kind: 'url', label: '' }, created_by: 1, updated_at: '', spec: {}, dataset })
    render(<BiStudio orgId={1} aiReady={false} />)
    await userEvent.click(screen.getByRole('tab', { name: 'Ссылка' }))
    const url = 'https://docs.google.com/spreadsheets/d/abc/edit#gid=0'
    await userEvent.type(screen.getByLabelText('Ссылка на таблицу'), url)
    await userEvent.click(screen.getByRole('button', { name: /Загрузить по ссылке/ }))
    await waitFor(() => expect(fromUrl).toHaveBeenCalledWith(1, url))
    await screen.findByRole('list', { name: 'Поля данных' })
    await userEvent.click(screen.getByRole('button', { name: /Сохранить/ }))
    await waitFor(() => expect(create.mock.calls[0][1].source).toEqual({ kind: 'url', label: url, url }))
  })

  it('connects to PostgreSQL, lists tables and loads one without keeping the password', async () => {
    vi.spyOn(reportsApi, 'tables').mockResolvedValue([{ name: 'public.sales', label: 'sales', rows: 1200 }])
    const load = vi.spyOn(reportsApi, 'load').mockResolvedValue(dataset)
    render(<BiStudio orgId={1} aiReady={false} />)
    await userEvent.click(screen.getByRole('tab', { name: 'Postgres' }))
    await userEvent.type(screen.getByLabelText('Хост PostgreSQL'), 'db.example.com')
    await userEvent.type(screen.getByLabelText('База данных'), 'erp')
    await userEvent.type(screen.getByLabelText('Пользователь PostgreSQL'), 'reader')
    await userEvent.type(screen.getByLabelText('Пароль PostgreSQL'), 'secret')
    await userEvent.click(screen.getByRole('button', { name: /Подключиться/ }))
    await userEvent.click(await screen.findByRole('button', { name: /sales/ }))
    await waitFor(() => expect(load).toHaveBeenCalledWith(1, expect.objectContaining({ kind: 'postgres' }), 'public.sales'))
    expect(await screen.findByText('PostgreSQL db.example.com/erp: sales')).toBeInTheDocument()
    expect(screen.queryByText(/secret/)).not.toBeInTheDocument()
  })
})

describe('BiStudio warehouse source', () => {
  it('lists warehouse entities, loads one and can refresh it without credentials', async () => {
    vi.spyOn(reportsApi, 'warehouseEntities').mockResolvedValue([{ connection_id: 3, connection_name: 'УТ', entity: 'Document_Sale', records: 2, last_ingested_at: null }])
    const load = vi.spyOn(reportsApi, 'warehouseLoad').mockResolvedValue(dataset)
    render(<BiStudio orgId={1} aiReady={false} />)
    await userEvent.click(await screen.findByRole('button', { name: /Document_Sale/ }))
    await waitFor(() => expect(load).toHaveBeenCalledWith(1, 3, 'Document_Sale'))
    expect(await screen.findByText('УТ: Document_Sale')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Обновить данные' }))
    await waitFor(() => expect(load).toHaveBeenCalledTimes(2))
  })
})

describe('planToVisuals', () => {
  it('maps AI widgets to visuals, cards first, without overlaps', () => {
    const visuals = planToVisuals([
      { type: 'bar', title: 'По группам', x: 'Группа', y: 'Выручка', agg: 'sum', limit: 10 },
      { type: 'kpi', title: 'Итого', x: null, y: 'Выручка', agg: 'sum', limit: 12 },
      { type: 'table', title: 'Таблица', x: 'Группа', y: 'Выручка', agg: 'sum', limit: 12 },
    ], newPage('p'))
    expect(visuals.map((v) => v.type)).toEqual(['card', 'bar', 'table'])
    expect(visuals[1].format.topN).toBe(10)
    expect(visuals[2].fields.columns).toEqual(['Группа', 'Выручка'])
    for (const a of visuals) for (const b of visuals) if (a !== b) expect(a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y).toBe(false)
  })
})
