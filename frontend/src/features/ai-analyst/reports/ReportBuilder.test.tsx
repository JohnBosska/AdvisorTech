import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { reportsApi } from '../../../lib/api/reports'
import { ReportBuilder } from './ReportBuilder'

const dataset = {
  filename: 'sales.csv', total_rows: 3, truncated: false,
  columns: [{ name: 'Группа', type: 'text' as const, samples: ['A'] }, { name: 'Выручка', type: 'number' as const, samples: ['10'] }],
  rows: [{ Группа: 'A', Выручка: 10 }, { Группа: 'B', Выручка: 20 }, { Группа: 'A', Выручка: 5.5 }],
}

describe('ReportBuilder', () => {
  it('uploads a table, builds a KPI by hand and computes it locally', async () => {
    vi.spyOn(reportsApi, 'upload').mockResolvedValue(dataset)
    render(<ReportBuilder orgId={1} aiReady={false} onClose={() => {}} />)
    fireEvent.change(screen.getByLabelText('Файл с данными'), { target: { files: [new File(['x'], 'sales.csv')] } })
    await screen.findByText(/3 строк · 2 колонок/)
    await userEvent.click(screen.getByRole('tab', { name: /Вручную/ }))
    await userEvent.click(screen.getByRole('radio', { name: 'KPI' }))
    await userEvent.click(screen.getByRole('button', { name: /Добавить виджет/ }))
    expect(await screen.findByText('35,5')).toBeInTheDocument()
  })

  it('asks the AI with column metadata only and shows the planned widgets', async () => {
    vi.spyOn(reportsApi, 'upload').mockResolvedValue(dataset)
    const plan = vi.spyOn(reportsApi, 'plan').mockResolvedValue({ title: 'Продажи', model: 'deepseek-flash', dropped: 0, widgets: [{ type: 'kpi', title: 'Итого', x: null, y: 'Выручка', agg: 'sum', limit: 12 }] })
    render(<ReportBuilder orgId={1} aiReady onClose={() => {}} />)
    fireEvent.change(screen.getByLabelText('Файл с данными'), { target: { files: [new File(['x'], 'sales.csv')] } })
    await screen.findByText(/3 строк · 2 колонок/)
    await userEvent.type(screen.getByLabelText('Опишите отчёт'), 'итог выручки')
    await userEvent.click(screen.getByRole('button', { name: 'Собрать отчёт' }))
    await waitFor(() => expect(plan).toHaveBeenCalledWith(1, 'итог выручки', dataset.columns))
    expect(await screen.findByText('Итого')).toBeInTheDocument()
    expect(screen.getByText('35,5')).toBeInTheDocument()
  })
})

describe('ReportBuilder data sources', () => {
  it('connects to PostgreSQL, lists tables and loads one', async () => {
    const tables = vi.spyOn(reportsApi, 'tables').mockResolvedValue([{ name: 'public.sales', label: 'sales', rows: 1200 }])
    const load = vi.spyOn(reportsApi, 'load').mockResolvedValue({ ...dataset, filename: 'sales' })
    render(<ReportBuilder orgId={1} aiReady={false} onClose={() => {}} />)
    await userEvent.click(screen.getByRole('tab', { name: 'Postgres' }))
    await userEvent.type(screen.getByLabelText('Хост PostgreSQL'), 'db.example.com')
    await userEvent.type(screen.getByLabelText('База данных'), 'erp')
    await userEvent.type(screen.getByLabelText('Пользователь PostgreSQL'), 'reader')
    await userEvent.click(screen.getByRole('button', { name: /Подключиться/ }))
    expect(tables).toHaveBeenCalledWith(1, { kind: 'postgres', postgres: { host: 'db.example.com', port: 5432, database: 'erp', user: 'reader', password: '', ssl: true } })
    await userEvent.click(await screen.findByRole('button', { name: /sales/ }))
    await waitFor(() => expect(load).toHaveBeenCalledWith(1, expect.objectContaining({ kind: 'postgres' }), 'public.sales'))
    expect(await screen.findByText(/sales · 3 строк · 2 колонок/)).toBeInTheDocument()
  })

  it('loads a Google Sheet by link', async () => {
    const fromUrl = vi.spyOn(reportsApi, 'fromUrl').mockResolvedValue({ ...dataset, filename: 'Продажи.csv' })
    render(<ReportBuilder orgId={1} aiReady={false} onClose={() => {}} />)
    await userEvent.click(screen.getByRole('tab', { name: 'Ссылка' }))
    await userEvent.type(screen.getByLabelText('Ссылка на таблицу'), 'https://docs.google.com/spreadsheets/d/abc/edit#gid=0')
    await userEvent.click(screen.getByRole('button', { name: /Загрузить по ссылке/ }))
    await waitFor(() => expect(fromUrl).toHaveBeenCalledWith(1, 'https://docs.google.com/spreadsheets/d/abc/edit#gid=0'))
    expect(await screen.findByText(/Продажи.csv · 3 строк/)).toBeInTheDocument()
  })
})
