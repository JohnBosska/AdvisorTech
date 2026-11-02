import { describe, expect, it } from 'vitest'
import { answerQuestion } from './ai'
import { balanceSheet, dashboard, groupRows, incomeStatement, PERIODS, ranges } from './data'

describe('demo dataset consistency', () => {
  it('group totals equal dashboard totals for every period', () => {
    for (const { key } of PERIODS) {
      const sum = groupRows(key).reduce((s, r) => s + r.revenue, 0)
      expect(sum).toBeCloseTo(dashboard(key).revenue.value, 6)
    }
  })
  it('has no previous period when history is not enough', () => {
    expect(ranges('M12').prev).toBeNull()
    expect(dashboard('M12').revenue.delta).toBeNull()
    expect(ranges('Q1').prev).not.toBeNull()
  })
  it('balance sheet balances and P&L chains', () => {
    for (const { key } of PERIODS) {
      const b = Object.fromEntries(balanceSheet(key).map((l) => [l.id, l.current]))
      expect(b.assets).toBeCloseTo(b.liab, 6)
      const p = Object.fromEntries(incomeStatement(key).map((l) => [l.id, l.current]))
      expect(p.rev + p.cogs).toBeCloseTo(p.gross, 6) // cogs is shown negative
    }
  })
})

describe('demo AI analyst', () => {
  it('answers with structure and flags hypotheses separately', () => {
    const a = answerQuestion('В каких группах самая низкая маржа?', 'Q1')
    expect(a.refusal).toBeUndefined()
    expect(a.metrics.length).toBeGreaterThan(0)
    expect(a.hypotheses.length).toBeGreaterThan(0)
    expect(a.sources.length).toBeGreaterThan(0)
  })
  it('refuses unsupported questions instead of inventing numbers', () => {
    const a = answerQuestion('Какая погода завтра?', 'Q1')
    expect(a.refusal).toBeTruthy()
    expect(a.metrics).toHaveLength(0)
  })
  it('refuses to explain a change when there is no previous period', () => {
    expect(answerQuestion('Почему изменилась прибыль?', 'M12').refusal).toBeTruthy()
  })
})
