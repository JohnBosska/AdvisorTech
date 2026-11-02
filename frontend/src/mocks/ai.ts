// DEMO AI Analyst. Answers are scripted templates over the demo dataset: there is no LLM, no Qdrant
// retrieval and no SQL tool behind them. The structure mirrors the contract in the product brief §5.5.
import { formatNumber, formatPercent, formatRub } from '../lib/format'
import type { PeriodKey } from '../stores/ui'
import type { ValidationStatus } from '../components/ui/StatusBadge'
import { CARRIERS, STOCK_ITEMS, SHORTAGE_RISKS, WAREHOUSES, dashboard, groupRows, logisticsView, periodMeta } from './data'

export interface AiAnswer {
  question: string
  summary: string
  period: string
  freshness: string
  validation: ValidationStatus
  metrics: { label: string; value: string; formula: string }[]
  findings: string[]
  hypotheses: string[]
  recommendations: { text: string; effect: string }[]
  sources: { id: string; label: string }[]
  assumptions: string[]
  refusal?: string
}

export const SUGGESTED_QUESTIONS = [
  'В каких товарных группах самая высокая и самая низкая валовая маржа?',
  'Почему изменилась валовая прибыль по сравнению с предыдущим периодом?',
  'На каких складах больше всего медленно оборачиваемых запасов?',
  'Какие товары могут оказаться в дефиците?',
  'Где выросли логистические расходы?',
]

const mln = (v: number) => `${formatNumber(v)} млн ₽`
const FRESH = 'Данные на 02.11.2026 05:01 (демо)'

export function answerQuestion(question: string, period: PeriodKey): AiAnswer {
  const q = question.toLowerCase()
  const p = periodMeta(period).long
  const base = { question, period: p, freshness: FRESH }

  if (/марж/.test(q)) {
    const rows = [...groupRows(period)].sort((a, b) => b.margin - a.margin)
    const hi = rows[0], lo = rows[rows.length - 1]
    return {
      ...base, validation: 'VALIDATED',
      summary: `Самая высокая валовая маржа — «${hi.name}» (${formatPercent(hi.margin * 100)}), самая низкая — «${lo.name}» (${formatPercent(lo.margin * 100)}).`,
      metrics: [
        { label: `Маржа «${hi.name}»`, value: formatPercent(hi.margin * 100), formula: 'валовая прибыль ÷ выручка' },
        { label: `Маржа «${lo.name}»`, value: formatPercent(lo.margin * 100), formula: 'валовая прибыль ÷ выручка' },
        { label: `Выручка «${lo.name}»`, value: mln(lo.revenue), formula: 'Σ реализаций за период без НДС' },
      ],
      findings: [`«${lo.name}» даёт ${formatPercent(lo.revenueShare * 100)} выручки, но только ${formatPercent(lo.grossShare * 100)} валовой прибыли.`, lo.marginDelta !== null ? `Изменение маржи к предыдущему периоду: ${lo.marginDelta > 0 ? '+' : ''}${lo.marginDelta.toFixed(1).replace('.', ',')} п.п.` : 'Сравнение с предыдущим периодом недоступно.'],
      hypotheses: ['Возможная причина — рост закупочных цен при сдерживаемых розничных (гипотеза, требует проверки по документам закупок).'],
      recommendations: [{ text: `Пересмотреть закупочные условия и скидки по группе «${lo.name}».`, effect: 'Оценка, не измеренный результат: +1 п.п. маржи группы увеличил бы валовую прибыль за период примерно на ' + mln(lo.revenue * 0.01) }],
      sources: [{ id: 'mart.product_group_profit', label: 'Витрина: прибыльность товарных групп' }, { id: 'kpi.gross_margin@v1', label: 'KPI «Валовая маржа», версия 1' }],
      assumptions: ['Себестоимость взята из источника 1С без пересчёта.', 'Возвраты и скидки учтены в выручке по правилам KPI v1.'],
    }
  }

  if (/приб/.test(q) || /почему/.test(q)) {
    const d = dashboard(period)
    const rows = groupRows(period).filter((r) => r.marginDelta !== null).sort((a, b) => (a.marginDelta ?? 0) - (b.marginDelta ?? 0))
    const worst = rows[0]
    if (d.gross.delta === null) return refusal(question, period, 'Для выбранного периода нет предыдущего периода сопоставимой длины, поэтому объяснить изменение нельзя. Выберите период короче.')
    return {
      ...base, validation: 'PARTIALLY_VALIDATED',
      summary: `Валовая прибыль ${d.gross.delta >= 0 ? 'выросла' : 'снизилась'} на ${formatPercent(Math.abs(d.gross.delta))} и составила ${mln(d.gross.value)}.`,
      metrics: [
        { label: 'Валовая прибыль', value: mln(d.gross.value), formula: 'выручка − себестоимость продаж' },
        { label: 'Выручка', value: mln(d.revenue.value), formula: 'Σ реализаций без НДС' },
        { label: 'Валовая маржа', value: formatPercent(d.margin.value), formula: 'валовая прибыль ÷ выручка' },
      ],
      findings: [worst ? `Наибольшее падение маржи — «${worst.name}»: ${(worst.marginDelta ?? 0).toFixed(1).replace('.', ',')} п.п.` : 'Существенных изменений маржи по группам нет.', `Выручка изменилась на ${d.revenue.delta === null ? '—' : formatPercent(d.revenue.delta)}.`],
      hypotheses: ['Часть эффекта может быть связана с сезонностью спроса (гипотеза).'],
      recommendations: [{ text: 'Проверить условия закупок по группам с падающей маржой.', effect: 'Оценка не рассчитывалась: нужны данные закупочных контрактов.' }],
      sources: [{ id: 'mart.pnl_summary', label: 'Витрина: сводка финансовых результатов' }, { id: 'kpi.gross_profit@v1', label: 'KPI «Валовая прибыль», версия 1' }],
      assumptions: ['Не сопоставлены 2 из 11 счетов; показатель управленческий, а не регламентированный.'],
    }
  }

  if (/склад/.test(q) || /медленн/.test(q) || /неликвид/.test(q)) {
    const slow = STOCK_ITEMS.filter((i) => i.daysNoSales >= 90)
    const by = WAREHOUSES.map((w) => ({ w, value: slow.filter((i) => i.warehouse === w.name).reduce((s, i) => s + i.value, 0) })).sort((a, b) => b.value - a.value)
    const total = by.reduce((s, x) => s + x.value, 0)
    return {
      ...base, validation: 'PARTIALLY_VALIDATED',
      summary: `Больше всего медленно оборачиваемых запасов на складе «${by[0].w.name}»: ${formatRub(by[0].value)} (${formatPercent((by[0].value / total) * 100)} от ${formatRub(total)}).`,
      metrics: [{ label: 'Стоимость запасов без движения ≥ 90 дн.', value: formatRub(total), formula: 'Σ остатков по позициям без продаж ≥ 90 дней' }, { label: `Склад «${by[0].w.name}»`, value: formatRub(by[0].value), formula: 'то же, по складу' }],
      findings: [`Позиций без продаж 90+ дней: ${slow.length} из ${STOCK_ITEMS.length}.`],
      hypotheses: ['Порог 90 дней принят по умолчанию; определение «медленного запаса» ещё не утверждено владельцем KPI.'],
      recommendations: [{ text: 'Рассмотреть перемещение или распродажу позиций без движения.', effect: 'Оценка: высвобождение оборотного капитала до ' + formatRub(total) + ' при полной реализации — верхняя граница, не прогноз.' }],
      sources: [{ id: 'mart.inventory_aging', label: 'Витрина: возраст запасов' }, { id: 'kpi.slow_stock@v0-draft', label: 'KPI «Медленный запас», черновик' }],
      assumptions: ['Сверка склада «Юг» выполнена частично.'],
    }
  }

  if (/дефицит|законч|нехват/.test(q)) {
    const risky = SHORTAGE_RISKS.filter((r) => r.coverDays < r.leadDays)
    return {
      ...base, validation: 'PARTIALLY_VALIDATED',
      summary: `Под риском дефицита ${risky.length} поз.: запас закончится раньше, чем придёт новая поставка.`,
      metrics: risky.map((r) => ({ label: r.name, value: `${r.coverDays} дн. запаса`, formula: `остаток ÷ средние продажи; срок поставки ${r.leadDays} дн.` })),
      findings: risky.map((r) => `«${r.name}» (${r.group}): покрытие ${r.coverDays} дн. при сроке поставки ${r.leadDays} дн.`),
      hypotheses: ['Прогноз спроса построен на средних продажах за 30 дней и не учитывает акции (допущение).'],
      recommendations: [{ text: 'Согласовать досрочный заказ по перечисленным позициям.', effect: 'Оценка не рассчитывалась.' }],
      sources: [{ id: 'mart.stock_cover', label: 'Витрина: покрытие запасом' }],
      assumptions: ['Сроки поставки взяты из справочника поставщиков (демо).'],
    }
  }

  if (/логист|доставк|перевоз/.test(q)) {
    const l = logisticsView(period)
    const worst = [...l.carriers].sort((a, b) => b.costPerShipment - a.costPerShipment)[0]
    return {
      ...base, validation: 'REQUIRES_ATTENTION',
      summary: `Логистические расходы за период — ${mln(l.cost)}${l.delta === null ? '' : ` (${l.delta > 0 ? '+' : ''}${formatPercent(l.delta)} к предыдущему периоду)`}; самая дорогая отправка у «${worst.name}».`,
      metrics: [{ label: 'Логистические расходы', value: mln(l.cost), formula: 'Σ расходов на доставку' }, { label: 'Доля в выручке', value: formatPercent(l.shareOfRevenue), formula: 'расходы ÷ выручка' }, { label: `Стоимость отправки «${worst.name}»`, value: formatRub(worst.costPerShipment), formula: 'расходы ÷ число отправок' }],
      findings: [`Среднее время доставки недоступно для «${CARRIERS[4].name}»: нет отметок отправки и доставки.`],
      hypotheses: ['Рост расходов может быть связан с сезонным ростом отправок (гипотеза).'],
      recommendations: [{ text: 'Включить фиксацию отметок доставки у собственного автопарка.', effect: 'Позволит рассчитать время доставки; эффект на расходы не оценивается.' }],
      sources: [{ id: 'mart.logistics_cost', label: 'Витрина: расходы на логистику' }],
      assumptions: ['Расходы по маршрутам не распределены — показатели по маршрутам не рассчитываются.'],
    }
  }

  return refusal(question, period, 'Этот вопрос не покрывается утверждёнными аналитическими инструментами демо-версии. Реальный AI-аналитик в таком случае не выдумывал бы ответ, а предложил уточнить вопрос или показатель.')
}

function refusal(question: string, period: PeriodKey, reason: string): AiAnswer {
  return { question, summary: 'Недостаточно данных для подтверждённого ответа.', period: periodMeta(period).long, freshness: FRESH, validation: 'REQUIRES_ATTENTION', metrics: [], findings: [], hypotheses: [], recommendations: [], sources: [], assumptions: [], refusal: reason }
}
