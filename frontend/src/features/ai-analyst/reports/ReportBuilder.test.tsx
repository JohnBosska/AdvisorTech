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
    await screen.findByText('3 строк · 2 колонок')
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
    await screen.findByText('3 строк · 2 колонок')
    await userEvent.type(screen.getByLabelText('Опишите отчёт'), 'итог выручки')
    await userEvent.click(screen.getByRole('button', { name: 'Собрать отчёт' }))
    await waitFor(() => expect(plan).toHaveBeenCalledWith(1, 'итог выручки', dataset.columns))
    expect(await screen.findByText('Итого')).toBeInTheDocument()
    expect(screen.getByText('35,5')).toBeInTheDocument()
  })
})
