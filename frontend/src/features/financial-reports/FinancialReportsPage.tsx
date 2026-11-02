import { Info } from 'lucide-react'
import { useState } from 'react'
import { Alert } from '../../components/feedback/Feedback'
import { PageHeader } from '../../components/feedback/PageHeader'
import { Button } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/Dialog'
import { Tabs } from '../../components/ui/Tabs'
import { ValidationBadge } from '../../components/ui/StatusBadge'
import { formatDateTime, formatNumber, formatRub } from '../../lib/format'
import { accountDrill, balanceSheet, cashFlow, DEMO_AS_OF, incomeStatement, MAPPING, periodMeta, type StatementLine } from '../../mocks/data'
import { downloadDemoCsv } from '../../mocks/export'
import { useUi } from '../../stores/ui'

type Tab = 'pnl' | 'balance' | 'cash'
const mln = (v: number) => formatNumber(v)

export function FinancialReportsPage() {
  const period = useUi((s) => s.period)
  const meta = periodMeta(period)
  const [tab, setTab] = useState<Tab>('pnl')
  const [line, setLine] = useState<StatementLine | null>(null)

  const lines = tab === 'pnl' ? incomeStatement(period) : tab === 'balance' ? balanceSheet(period) : cashFlow(period)
  const title = { pnl: 'Отчёт о финансовых результатах', balance: 'Бухгалтерский баланс', cash: 'Движение денежных средств' }[tab]
  const hasPrev = lines.some((l) => l.previous !== null)

  const exportCsv = () => downloadDemoCsv(`demo-${tab}.csv`, [[title, meta.long], ['Показатель', 'Счёт', 'Текущий, млн ₽', 'Предыдущий, млн ₽'], ...lines.map((l) => [l.label, l.account, l.current.toFixed(2), l.previous === null ? '' : l.previous.toFixed(2)])])

  return (
    <div className="space-y-6">
      <PageHeader title="Финансовая отчётность" description="Отчётность для собственника, ориентированная на применимые требования РСБУ." actions={<Button variant="secondary" size="sm" onClick={exportCsv}>Экспорт (демо CSV)</Button>} />

      <div className="grid gap-4 md:grid-cols-[1fr_auto]">
        <Alert tone="warning">Это управленческое представление, а не аудиторское заключение и не регламентированная отчётность. Полнота зависит от конфигурации 1С и проверенных правил сопоставления счетов. Показатели рассчитаны на демо-данных.</Alert>
        <div className="flex items-center gap-3 rounded-[var(--radius-md)] border border-border px-4 py-2 text-xs text-muted">
          <ValidationBadge status="PARTIALLY_VALIDATED" />
          <span>Сопоставлено {MAPPING.mapped} из {MAPPING.accounts} счетов · {MAPPING.version}<br />Данные на {formatDateTime(DEMO_AS_OF)}</span>
        </div>
      </div>
      <details className="rounded-[var(--radius-md)] border border-border px-4 py-3 text-sm">
        <summary className="cursor-pointer text-text-soft">Что не сопоставлено ({MAPPING.missing.length})</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">{MAPPING.missing.map((m) => <li key={m}>{m}</li>)}</ul>
      </details>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs label="Тип отчёта" value={tab} onChange={setTab} tabs={[{ id: 'pnl', label: 'Финансовые результаты' }, { id: 'balance', label: 'Баланс' }, { id: 'cash', label: 'Денежные потоки' }]} />
        <p className="font-mono text-[11px] text-muted">{meta.long}{hasPrev ? ' · сравнение с предыдущим периодом' : ' · нет сравнения: мало истории'}</p>
      </div>

      <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-border">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <caption className="sr-only">{title}, {meta.long}, млн рублей</caption>
          <thead className="bg-surface-1 text-[12px] text-muted"><tr><th className="px-4 py-3 text-left font-medium">Показатель</th><th className="px-4 py-3 text-left font-medium">Счёт</th><th className="px-4 py-3 text-right font-medium">Текущий, млн ₽</th><th className="px-4 py-3 text-right font-medium">Предыдущий, млн ₽</th><th className="px-4 py-3 text-right font-medium">Изм.</th></tr></thead>
          <tbody>
            {lines.map((l) => {
              const change = l.previous ? ((l.current - l.previous) / Math.abs(l.previous)) * 100 : null
              return (
                <tr key={l.id} className="border-t border-border hover:bg-surface-2">
                  <td className={`px-4 py-2.5 ${l.bold ? 'font-semibold' : ''}`}>
                    <button type="button" onClick={() => setLine(l)} className="inline-flex items-center gap-1.5 text-left hover:text-accent" aria-label={`Подробнее: ${l.label}`}>{l.label}<Info className="h-3 w-3 text-muted" aria-hidden /></button>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-muted">{l.account || '—'}</td>
                  <td className={`tabular px-4 py-2.5 text-right ${l.bold ? 'font-semibold' : ''}`}>{mln(l.current)}</td>
                  <td className="tabular px-4 py-2.5 text-right text-muted">{l.previous === null ? 'н/д' : mln(l.previous)}</td>
                  <td className="tabular px-4 py-2.5 text-right text-muted">{change === null ? '—' : `${change > 0 ? '+' : ''}${change.toFixed(1).replace('.', ',')}%`}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <Dialog open={!!line} onClose={() => setLine(null)} title={line?.label ?? ''} description={line?.account ? `Счёт ${line.account} · ${meta.long}` : meta.long} wide>
        {line && (
          <div className="space-y-4">
            <p className="text-sm text-text-soft">{line.hint}</p>
            {line.account ? (
              <>
                <h3 className="font-mono text-[11px] uppercase tracking-wider text-muted">Документы и проводки (демо)</h3>
                <div className="overflow-x-auto rounded-[var(--radius-md)] border border-border">
                  <table className="w-full text-sm"><caption className="sr-only">Документы по счёту {line.account}</caption>
                    <thead className="bg-surface-1 text-xs text-muted"><tr><th className="px-3 py-2 text-left font-medium">Документ</th><th className="px-3 py-2 text-left font-medium">Дата</th><th className="px-3 py-2 text-left font-medium">Корреспонденция</th><th className="px-3 py-2 text-right font-medium">Сумма</th></tr></thead>
                    <tbody>{accountDrill(line.account, Math.abs(line.current) * 1e6).map((r) => <tr key={r.doc} className="border-t border-border"><td className="px-3 py-2">{r.doc}</td><td className="px-3 py-2 text-muted">{r.date}</td><td className="px-3 py-2 font-mono text-xs">{r.correspondence}</td><td className="tabular px-3 py-2 text-right">{formatRub(r.amount)}</td></tr>)}</tbody>
                  </table>
                </div>
                <p className="text-xs text-muted">Переход к исходным документам в 1С доступен при наличии прав; в демо показаны примерные записи.</p>
              </>
            ) : <p className="text-sm text-muted">Итоговая строка: детализация по счетам не применяется.</p>}
          </div>
        )}
      </Dialog>
    </div>
  )
}
