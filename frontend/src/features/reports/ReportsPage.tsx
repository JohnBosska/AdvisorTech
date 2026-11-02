import { Download, Plus } from 'lucide-react'
import { useState } from 'react'
import { DemoNotice, EmptyState } from '../../components/feedback/Feedback'
import { PageHeader } from '../../components/feedback/PageHeader'
import { Button } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/Dialog'
import { SelectField } from '../../components/ui/Field'
import { RunStateBadge, type RunState } from '../../components/ui/StatusBadge'
import { formatDateTime } from '../../lib/format'
import { periodMeta, REPORT_KINDS, type ReportKind } from '../../mocks/data'
import { downloadDemoCsv } from '../../mocks/export'
import { useReports, type DemoReport } from '../../stores/reports'
import { useUi } from '../../stores/ui'

export function ReportsPage() {
  const period = useUi((s) => s.period)
  const { reports, create } = useReports()
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<ReportKind>('executive')
  const [filter, setFilter] = useState<'all' | RunState>('all')
  const list = filter === 'all' ? reports : reports.filter((r) => r.state === filter)
  const sheets = REPORT_KINDS.find((k) => k.id === kind)!.sheets

  const download = (r: DemoReport) => {
    const k = REPORT_KINDS.find((x) => x.id === r.kind)!
    downloadDemoCsv(`demo-report-${r.id}.csv`, [['Отчёт', r.title], ['Период', r.period], ['Сформирован', formatDateTime(r.createdAt)], ['Листы реальной книги Excel', k.sheets.join(', ')], ['Статус', 'ДЕМО: настоящая книга .xlsx формируется на сервере']])
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Отчёты" description="Аналитические отчёты: проверенные расчёты отдельно от рекомендаций AI." actions={<Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" aria-hidden />Новый отчёт</Button>} />
      <DemoNotice>Генерация Excel-книг на сервере ещё не реализована. Создание и статусы здесь симулируются, а скачивается демонстрационный CSV, а не настоящая книга .xlsx.</DemoNotice>
      <div className="max-w-xs"><SelectField label="Статус" value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}><option value="all">Все</option><option value="queued">В очереди</option><option value="processing">Формируются</option><option value="ready">Готовы</option><option value="failed">С ошибкой</option><option value="expired">Срок истёк</option></SelectField></div>
      {list.length === 0 ? <EmptyState title="Нет отчётов с таким статусом" /> : (
        <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-border">
          <table className="w-full min-w-[640px] text-sm"><caption className="sr-only">Список отчётов</caption>
            <thead className="bg-surface-1 text-xs text-muted"><tr><th className="px-4 py-3 text-left font-medium">Отчёт</th><th className="px-4 py-3 text-left font-medium">Период</th><th className="px-4 py-3 text-left font-medium">Создан</th><th className="px-4 py-3 text-left font-medium">Статус</th><th className="px-4 py-3 text-right font-medium">Действие</th></tr></thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id} className="border-t border-border align-top">
                  <td className="px-4 py-3"><p className="font-medium">{r.title}</p>{r.note && <p className="mt-1 max-w-sm text-xs text-muted">{r.note}</p>}</td>
                  <td className="px-4 py-3 text-muted">{r.period}</td>
                  <td className="px-4 py-3 text-muted">{formatDateTime(r.createdAt)}</td>
                  <td className="px-4 py-3"><RunStateBadge state={r.state} /></td>
                  <td className="px-4 py-3 text-right">{r.state === 'ready' ? <Button size="sm" variant="secondary" onClick={() => download(r)}><Download className="h-3.5 w-3.5" aria-hidden />Скачать (демо)</Button> : r.state === 'failed' || r.state === 'expired' ? <Button size="sm" variant="ghost" onClick={() => create(r.kind, periodMeta(period).long, r.title)}>Повторить</Button> : <span className="text-xs text-muted">Подождите…</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Dialog open={open} onClose={() => setOpen(false)} title="Новый отчёт" description={`Период: ${periodMeta(period).long} (меняется в шапке)`}>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); create(kind, periodMeta(period).long); setOpen(false) }}>
          <SelectField label="Тип отчёта" value={kind} onChange={(e) => setKind(e.target.value as ReportKind)}>{REPORT_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}</SelectField>
          <div><p className="text-xs text-muted">Листы книги:</p><ul className="mt-1.5 flex flex-wrap gap-1.5">{sheets.map((s) => <li key={s} className="rounded-full border border-border px-2.5 py-0.5 text-xs">{s}</li>)}</ul></div>
          <Button type="submit">Сформировать</Button>
        </form>
      </Dialog>
    </div>
  )
}
