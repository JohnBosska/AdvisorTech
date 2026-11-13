import { DatabaseBackup, HardDrive, Layers, ServerCog } from 'lucide-react'
import { PageHeader } from '../../components/feedback/PageHeader'
import { DemoNotice } from '../../components/feedback/Feedback'
import { Badge } from '../../components/ui/StatusBadge'
import { formatDateTime, formatNumber } from '../../lib/format'
import { INFRA } from '../../mocks/data'

export function DataInfrastructurePage() {
  const pct = (INFRA.disk.usedGb / INFRA.disk.limitGb) * 100
  return (
    <div className="space-y-6">
      <PageHeader title="Инфраструктура данных" description="Состояние вашей облачной аналитической среды PostgreSQL. Платформа управляет базой за вас: развёртыванием, миграциями, резервным копированием." />
      <DemoNotice>Автоматическое развёртывание PostgreSQL для клиента ещё не реализовано. Экран показывает, какую информацию вы увидите после запуска; все значения — пример.</DemoNotice>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          { icon: ServerCog, l: 'Статус', v: INFRA.status, extra: <Badge tone="success">работает</Badge> },
          { icon: Layers, l: 'Версия', v: INFRA.version, extra: <span className="text-xs text-muted">регион: {INFRA.region}</span> },
          { icon: HardDrive, l: 'Диск', v: `${INFRA.disk.usedGb} из ${INFRA.disk.limitGb} ГБ`, extra: <span className="text-xs text-muted">{pct.toFixed(0)}% использовано</span> },
          { icon: DatabaseBackup, l: 'Резервные копии', v: INFRA.backup.state, extra: <span className="text-xs text-muted">последняя {formatDateTime(INFRA.backup.lastAt)}</span> },
        ].map(({ icon: Icon, l, v, extra }) => (
          <section key={l} aria-label={l} className="rounded-[var(--radius-lg)] border border-border bg-surface-1 p-5">
            <Icon className="h-4 w-4 text-accent-ink" aria-hidden />
            <p className="mt-3 text-xs text-muted">{l}</p><p className="mt-1 text-lg font-semibold">{v}</p><div className="mt-2">{extra}</div>
          </section>
        ))}
      </div>

      <section className="rounded-[var(--radius-lg)] border border-border bg-surface-1 p-5">
        <h2 className="text-[15px] font-medium">Использование диска</h2>
        <div role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label="Использование диска" className="mt-3 h-2 rounded-full bg-surface-3"><div className="h-full rounded-full bg-gradient-to-r from-accent to-cyan" style={{ width: `${pct}%` }} /></div>
        <p className="mt-2 text-xs text-muted">Последняя успешная загрузка: {formatDateTime(INFRA.lastLoadAt)} · развёрнуто {formatDateTime(INFRA.provisionedAt)}</p>
      </section>

      <section className="rounded-[var(--radius-lg)] border border-border bg-surface-1 p-5">
        <h2 className="text-[15px] font-medium">Слои данных</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm"><caption className="sr-only">Слои аналитической базы</caption>
            <thead className="text-xs text-muted"><tr><th className="py-2 text-left font-medium">Слой</th><th className="py-2 text-left font-medium">Назначение</th><th className="py-2 text-right font-medium">Строк</th><th className="py-2 text-right font-medium">Обновлён</th></tr></thead>
            <tbody>{INFRA.layers.map((l) => <tr key={l.name} className="border-t border-border"><td className="py-2.5 font-mono text-xs text-accent-ink">{l.name}</td><td className="py-2.5 text-muted">{l.desc}</td><td className="tabular py-2.5 text-right">{formatNumber(l.rows)}</td><td className="py-2.5 text-right text-muted">{formatDateTime(l.updated)}</td></tr>)}</tbody>
          </table>
        </div>
      </section>

      <section className="rounded-[var(--radius-lg)] border border-border bg-surface-1 p-5">
        <h2 className="text-[15px] font-medium">Данные для подключения</h2>
        <dl className="mt-3 grid gap-y-2 text-sm sm:grid-cols-[160px_1fr]">
          {Object.entries(INFRA.connection).map(([k, v]) => <div key={k} className="contents"><dt className="text-muted">{{ host: 'Хост', port: 'Порт', database: 'База данных', user: 'Пользователь', password: 'Пароль' }[k]}</dt><dd className="font-mono text-xs">{v}</dd></div>)}
        </dl>
        <p className="mt-3 text-xs text-muted">Учётные данные скрыты по умолчанию и хранятся в менеджере секретов платформы.</p>
      </section>
    </div>
  )
}
