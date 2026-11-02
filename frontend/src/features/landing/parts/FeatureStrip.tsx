import { useEffect, useState } from 'react'
import { Label, TwoTone } from './Blocks'
import { prefersReducedMotion, useInView } from './useInView'

/** Ticks while visible; drives all mini-card animations from one clock. */
function useTick(ms: number, active: boolean, max = Infinity) {
  const [tick, setTick] = useState(0)
  const reduced = prefersReducedMotion()
  useEffect(() => {
    if (!active || reduced) return
    const id = setInterval(() => setTick((x) => x + 1), ms)
    return () => clearInterval(id)
  }, [ms, active, reduced])
  if (reduced) return max
  return active ? tick % (max + 1) : 0
}

const Card = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div aria-hidden className={`h-[230px] overflow-hidden bg-[#1b1d1f] p-4 font-mono text-[11px] text-[#c9cdca] ${className}`}>{children}</div>
)

function SyncCard({ on }: { on: boolean }) {
  const t = useTick(110, on, 56)
  const done = Math.min(48, t)
  return (
    <Card>
      <div className="flex items-center justify-between"><span className="rounded-sm bg-black/40 px-2 py-0.5 text-white">● {done >= 48 ? 'Готово' : 'Загрузка'}</span><span className="text-[#8a8f8c]">{done}/48 пакетов</span></div>
      <div className="mt-3 grid grid-cols-[repeat(24,1fr)] gap-[2px]">{Array.from({ length: 48 }, (_, i) => <i key={i} className={`h-2 ${i < done ? 'bg-accent' : 'bg-white/10'}`} />)}</div>
      <ul className="mt-5 space-y-2">
        {['Подключение к 1С (чтение)…', 'Нормализация записей…', 'Сверка итогов…'].map((s, i) => <li key={s} className="flex items-center gap-2"><span className={`grid h-3 w-3 place-items-center border ${done > i * 16 + 14 ? 'border-accent bg-accent text-black' : 'border-white/30'}`}>{done > i * 16 + 14 ? '✓' : ''}</span><span className={done > i * 16 ? 'text-white' : 'text-[#6e7370]'}>{s}</span></li>)}
      </ul>
    </Card>
  )
}

function LayersCard({ on }: { on: boolean }) {
  const t = useTick(900, on, 4)
  const layers = ['raw', 'staging', 'core', 'marts']
  return (
    <Card className="relative">
      <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
        <line x1="100" y1="30" x2="100" y2="190" stroke="#34d59a" strokeOpacity=".5" />
        {[0.2, 0.2].map((_, i) => <circle key={i} cx="100" cy={30 + ((t * 40 + i * 80) % 160)} r="2" fill="#34d59a" />)}
      </svg>
      <div className="relative flex h-full flex-col items-center justify-between py-1">
        {layers.map((l, i) => <div key={l} className={`rounded-full border px-3 py-1 transition-colors duration-500 ${t % 4 === i ? 'border-accent bg-accent/20 text-white' : 'border-white/20 bg-black/40'}`}>{i === 0 ? '▣ ' : '○ '}{l}</div>)}
      </div>
    </Card>
  )
}

function KpiCard({ on }: { on: boolean }) {
  const t = useTick(1400, on, 3)
  const sets = [[40, 62, 55, 80, 70], [52, 48, 66, 58, 90], [30, 70, 45, 86, 60], [60, 55, 72, 64, 78]]
  return (
    <Card>
      <p className="text-[#8a8f8c]">валовая маржа · по группам</p>
      <div className="mt-3 flex h-[104px] items-end gap-2">{sets[t % 4].map((v, i) => <i key={i} className="flex-1 bg-accent/80 transition-[height] duration-700" style={{ height: `${v}%` }} />)}</div>
      <p className="mt-4 text-white">KPI gross_margin@v1</p>
      <p className="text-[#8a8f8c]">период · источник · статус проверки</p>
    </Card>
  )
}

const QUERY = 'SELECT group, margin FROM mart.product_group_profit WHERE period = :p'
function AiCard({ on }: { on: boolean }) {
  const t = useTick(70, on, 120)
  const typed = QUERY.slice(0, Math.min(QUERY.length, t))
  const resultAt = QUERY.length + 8
  return (
    <Card>
      <div className="rounded-sm border border-white/15 p-2.5"><span className="text-accent">●</span> <span className="text-white">{typed}</span>{t < resultAt && <span className="caret" />}</div>
      <div className={`mt-4 space-y-1 transition-opacity duration-500 ${t >= resultAt ? 'opacity-100' : 'opacity-0'}`}>
        <p className="text-[#8a8f8c]">→ результат из витрины</p>
        <p className="text-white">Электроника · 15,3%</p>
        <p className="text-warning">гипотеза AI: помечена отдельно</p>
      </div>
    </Card>
  )
}

const ITEMS = [
  { lead: 'Интеграция.', text: 'Подключение 1С только на чтение: агент у вас, соединение исходящее.', C: SyncCard },
  { lead: 'Данные.', text: 'Отдельная облачная PostgreSQL: Raw, Staging, Core, Marts.', C: LayersCard },
  { lead: 'Аналитика.', text: 'Товарные группы, запасы, склады и логистика по согласованным KPI.', C: KpiCard },
  { lead: 'AI-аналитик.', text: 'Запрос к утверждённым витринам, объяснение и рекомендации.', C: AiCard },
]

export function FeatureStrip() {
  const [ref, on] = useInView<HTMLDivElement>({ repeat: true, margin: '0px' })
  return (
    <section id="product" className="mx-auto max-w-[1180px] px-4 pb-24 pt-24 sm:px-6">
      <Label>Соберите аналитику</Label>
      <p className="lp-num mt-6" aria-hidden>01</p>
      <TwoTone lead="Не просто отчёты." className="mt-10 max-w-[900px]">{'Tech Adviser — слой аналитики поверх 1С: интеграция, облачная база, AI-аналитик и Excel-отчёты.'}</TwoTone>
      <div ref={ref} className="mt-16 grid gap-px bg-white/10 md:grid-cols-2 lg:grid-cols-4">
        {ITEMS.map(({ lead, text, C }) => (
          <div key={lead} className="flex flex-col bg-paper pr-0 lg:pr-4">
            <p className="min-h-[96px] pb-4 text-[15px] leading-snug"><span className="text-ink-soft">{lead} </span>{text}</p>
            <C on={on} />
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs text-ink-soft">Анимации — иллюстрации принципа, а не живые данные.</p>
    </section>
  )
}
