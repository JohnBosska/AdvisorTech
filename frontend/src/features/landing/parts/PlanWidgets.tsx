import { Database, FileSpreadsheet, ShieldCheck, Sparkles } from 'lucide-react'

/** Neon-style dark panels. All four are illustrations of the principle, not live data. */
const Panel = ({ children, label }: { children: React.ReactNode; label: string }) => (
  <div className="plan-widget relative h-[236px] overflow-hidden rounded-xl border border-white/10 bg-[#080a09] p-4 font-mono text-[11px] text-[#c9cdca]" role="img" aria-label={label}>
    <div className="pointer-events-none absolute -right-10 -top-16 h-44 w-44 rounded-full bg-[radial-gradient(closest-side,rgb(32_183_123/.22),transparent)]" aria-hidden />
    <div className="relative h-full" aria-hidden>{children}</div>
  </div>
)

const Node = ({ children, active }: { children: React.ReactNode; active?: boolean }) => (
  <span className={`rounded-md border px-2.5 py-1.5 ${active ? 'border-accent/60 bg-accent/10 text-white' : 'border-white/15 bg-white/[0.03]'}`}>{children}</span>
)

function IntegrationWidget() {
  return (
    <Panel label="Схема: 1С, Connector Agent, облако — только чтение, исходящее соединение">
      <div className="flex h-full flex-col justify-between">
        <div className="flex items-center justify-between text-[#8a8f8c]"><span>connector · read-only</span><span className="flex items-center gap-1.5"><i className="h-1.5 w-1.5 rounded-full bg-accent plan-pulse" />исходящее</span></div>
        <div className="flex items-center justify-between">
          <Node>1С</Node>
          <svg viewBox="0 0 60 8" className="h-2 w-[18%]"><line x1="0" y1="4" x2="60" y2="4" stroke="#34d59a" strokeOpacity=".7" className="dash-flow" strokeWidth="1.5" /></svg>
          <Node active>Agent</Node>
          <svg viewBox="0 0 60 8" className="h-2 w-[18%]"><line x1="0" y1="4" x2="60" y2="4" stroke="#34d59a" strokeOpacity=".7" className="dash-flow" strokeWidth="1.5" /></svg>
          <Node>Cloud</Node>
        </div>
        <div className="flex flex-wrap gap-2 text-[10px]">
          <span className="flex items-center gap-1 rounded-full border border-white/15 px-2 py-1"><ShieldCheck className="h-3 w-3 text-accent" />запись запрещена</span>
          <span className="rounded-full border border-white/15 px-2 py-1">без входящих портов</span>
        </div>
      </div>
    </Panel>
  )
}

function PostgresWidget() {
  const layers = [['raw', 92], ['staging', 74], ['core', 58], ['marts', 40]] as const
  return (
    <Panel label="Слои облачной PostgreSQL: raw, staging, core, marts">
      <div className="flex h-full flex-col justify-between">
        <div className="flex items-center justify-between"><span className="flex items-center gap-1.5 text-white"><Database className="h-3.5 w-3.5 text-accent" />postgres</span><span className="rounded border border-white/15 px-1.5 py-0.5 text-[10px] text-[#8a8f8c]">pgvector</span></div>
        <ul className="space-y-2">
          {layers.map(([n, w], i) => (
            <li key={n} className="flex items-center gap-3"><span className="w-14 text-[#8a8f8c]">{n}</span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.06]"><i className="plan-grow block h-full rounded-full bg-gradient-to-r from-accent/30 to-accent" style={{ width: `${w}%`, animationDelay: `${i * 0.25}s` }} /></span>
            </li>
          ))}
        </ul>
        <p className="text-[10px] text-[#6e7370]">миграции · бэкапы · изоляция клиентов</p>
      </div>
    </Panel>
  )
}

function AnalyticsWidget() {
  const bars = [38, 56, 44, 70, 52, 82, 64, 90]
  return (
    <Panel label="Пример столбчатой диаграммы KPI (демо-данные)">
      <div className="flex h-full flex-col justify-between">
        <div className="flex items-center justify-between"><span className="text-white">валовая маржа · группы</span><span className="rounded border border-warning/40 px-1.5 py-0.5 text-[10px] text-warning">Демо-данные</span></div>
        <div className="flex h-[104px] items-end gap-2">
          {bars.map((h, i) => <i key={i} className="plan-rise flex-1 rounded-t-[3px] bg-gradient-to-t from-accent/15 to-accent" style={{ height: `${h}%`, animationDelay: `${i * 0.12}s`, opacity: 0.55 + h / 250 }} />)}
        </div>
        <div className="flex justify-between text-[10px] text-[#6e7370]"><span>KPI gross_margin@v1</span><span>источник · период · проверка</span></div>
      </div>
    </Panel>
  )
}

function AiWidget() {
  return (
    <Panel label="Пример ответа AI со ссылкой на источник и выгрузкой в Excel">
      <div className="flex h-full flex-col justify-between">
        <p className="ml-auto max-w-[80%] rounded-lg rounded-br-sm bg-white/[0.07] px-3 py-2 text-white">Какие условия скидок у поставщика?</p>
        <div className="max-w-[92%] rounded-lg rounded-bl-sm border border-accent/30 bg-accent/[0.06] px-3 py-2">
          <p className="flex items-center gap-1.5 text-white"><Sparkles className="h-3 w-3 text-accent" />Ответ по документам <span className="rounded bg-accent/20 px-1 text-accent">[1]</span></p>
          <p className="mt-1 text-[#8a8f8c]">ссылки и числа проверяются</p>
        </div>
        <span className="flex w-fit items-center gap-2 rounded-md border border-white/15 px-2.5 py-1.5"><FileSpreadsheet className="h-3.5 w-3.5 text-accent" />отчёт.xlsx · 4 листа</span>
      </div>
    </Panel>
  )
}

export const PLAN_WIDGETS = { burst: IntegrationWidget, ring: PostgresWidget, bars: AnalyticsWidget, wave: AiWidget } as const
