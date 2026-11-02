import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { Stage } from '../../lib/api/ai'
import { parseSse } from '../../lib/api/client'
import { PipelineColumn } from './PipelineColumn'
import { edgeState, splitBold, splitCitations, statusMap } from './rag'

const stage = (id: string, status: Stage['status'], extra: Partial<Stage> = {}): Stage => ({ id, status, ...extra })

describe('SSE parsing', () => {
  it('returns complete events and keeps the unfinished tail', () => {
    const { events, rest } = parseSse('data: {"type":"stage"}\n\ndata: {"type":"done"}\n\ndata: {"ty')
    expect(events).toEqual([{ type: 'stage' }, { type: 'done' }])
    expect(rest).toBe('data: {"ty')
  })
  it('skips malformed and empty events', () => {
    expect(parseSse('data: nope\n\n: keep-alive\n\ndata: {"a":1}\n\n').events).toEqual([{ a: 1 }])
  })
})

describe('citations', () => {
  it('splits answer text into text and numbered references', () => {
    expect(splitCitations('Маржа [1] и скидки [2].')).toEqual([{ text: 'Маржа ' }, { ref: 1 }, { text: ' и скидки ' }, { ref: 2 }, { text: '.' }])
    expect(splitCitations('без ссылок')).toEqual([{ text: 'без ссылок' }])
  })
})

describe('inline formatting', () => {
  it('turns **x** into bold parts and never interprets anything else', () => {
    expect(splitBold('**Коротко:** итог <b>x</b>')).toEqual([{ text: 'Коротко:', bold: true }, { text: ' итог <b>x</b>', bold: false }])
  })
})

describe('pipeline state', () => {
  it('lights an edge only while the next stage runs after a finished one', () => {
    expect(edgeState('completed', 'running')).toBe('active')
    expect(edgeState('completed', 'completed')).toBe('done')
    expect(edgeState('completed', 'skipped')).toBe('muted')
    expect(edgeState('idle', 'idle')).toBe('idle')
  })
  it('marks the user query node as done once a run exists', () => {
    expect(statusMap([], false).user_query).toBe('idle')
    expect(statusMap([stage('query_analysis', 'running')], true).user_query).toBe('completed')
  })
})

describe('PipelineColumn', () => {
  const stages = {
    query_analysis: stage('query_analysis', 'completed', { summary: 'Ключевых слов для поиска: 3', duration_ms: 2, count: 3 }),
    fulltext_retrieval: stage('fulltext_retrieval', 'completed', { duration_ms: 12, count: 4 }),
    sql_analytics: stage('sql_analytics', 'skipped', { summary: 'Хранилище данных 1С не подключено' }),
    llm_generation: stage('llm_generation', 'failed', { summary: 'Модель недоступна' }),
  }

  it('shows per-node statuses and the details of a clicked stage', async () => {
    render(<PipelineColumn stages={stages} started running={false} caption="Какая скидка?" durationMs={1500} error="Ошибка модели" />)
    const nodes = document.querySelectorAll('svg [data-stage]')
    expect(nodes.length).toBe(11)
    expect(document.querySelector('[data-stage="sql_analytics"]')?.getAttribute('data-status')).toBe('skipped')
    expect(document.querySelector('[data-stage="llm_generation"]')?.getAttribute('data-status')).toBe('failed')
    expect(screen.getByText('ошибка')).toBeInTheDocument()

    await userEvent.click(document.querySelector('[data-stage="query_analysis"]')!)
    expect(screen.getAllByText('Ключевых слов для поиска: 3').length).toBeGreaterThan(0)
    expect(screen.getByText(/Время: 2 мс · элементов: 3/)).toBeInTheDocument()
  })

  it('is idle with an invitation to ask when nothing has run', () => {
    render(<PipelineColumn stages={{}} started={false} running={false} caption="" />)
    expect(screen.getByText('ожидание')).toBeInTheDocument()
    expect(document.querySelector('[data-stage="final_answer"]')?.getAttribute('data-status')).toBe('idle')
  })
})
