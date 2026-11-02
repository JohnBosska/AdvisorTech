import { useEffect, useState } from 'react'
import { TwoTone } from './Blocks'
import { prefersReducedMotion } from './useInView'

/** Pixel-grid icon: white squares that blink in a pseudo-random pattern. */
function Pixels({ seed }: { seed: number }) {
  const [t, setT] = useState(0)
  useEffect(() => {
    if (prefersReducedMotion()) return
    const id = setInterval(() => setT((x) => x + 1), 450)
    return () => clearInterval(id)
  }, [])
  return (
    <div className="mx-auto grid h-[92px] w-[92px] grid-cols-5 gap-1.5 p-2" aria-hidden>
      {Array.from({ length: 25 }, (_, i) => {
        const v = Math.sin((i + 1) * (seed + 3) + t * (0.7 + seed * 0.1) * ((i % 3) + 1))
        return <i key={i} className="block bg-white transition-opacity duration-300" style={{ opacity: v > 0.35 ? 1 : v > -0.2 ? 0.3 : 0.07 }} />
      })}
    </div>
  )
}

const CALLOUTS = [
  { id: 'a', title: 'ТОЛЬКО ЧТЕНИЕ', lines: ['Агент читает 1С', 'Запись не выполняется'], pos: 'left-[1%] top-[6%]', seed: 1, at: [27, 33] },
  { id: 'b', title: 'ИСХОДЯЩЕЕ СОЕДИНЕНИЕ', lines: ['Шифрованный канал', 'Без входящих портов'], pos: 'left-[38%] top-[0%]', seed: 2, at: [47, 35] },
  { id: 'c', title: 'КАЧЕСТВО ДАННЫХ', lines: ['Сверка и полнота', 'Статусы проверки'], pos: 'right-[1%] top-[10%]', seed: 3, at: [64, 46] },
  { id: 'd', title: 'ПРОСЛЕЖИВАЕМОСТЬ', lines: ['Версии и источники', 'Идемпотентные повторы'], pos: 'left-[1%] bottom-[-14%]', seed: 4, at: [30, 66] },
  { id: 'e', title: 'ИЗОЛЯЦИЯ КЛИЕНТОВ', lines: ['Отдельная БД', 'Проверка tenant'], pos: 'right-[2%] bottom-[-14%]', seed: 5, at: [64, 66] },
]

function Callout({ c }: { c: (typeof CALLOUTS)[number] }) {
  return (
    <div className="corner-box w-full bg-[#1b1d1f] p-4 pt-5 text-white">
      <Pixels seed={c.seed} />
      <p className="mt-3 font-mono text-[13px] font-semibold tracking-wide">{c.title}</p>
      {c.lines.map((l) => <p key={l} className="font-mono text-[11px] text-[#9aa09c]">{l}</p>)}
    </div>
  )
}

const box = 'absolute flex items-center justify-center border border-ink/40 bg-white/70 text-center text-[11px] text-ink/80'

export function Architecture() {
  return (
    <section className="mx-auto max-w-[1180px] px-4 py-24 sm:px-6">
      <TwoTone lead="Способ построения аналитики меняется, но основа остаётся прежней:" className="max-w-[900px]">{'надёжные данные, прослеживаемые расчёты и понятные решения.'}</TwoTone>
      <div className="mt-6 border-t border-ink/30" />

      <div className="relative mb-40 mt-8 hidden aspect-[1000/640] lg:block">
        <div className="absolute inset-x-0 top-[27%] bottom-[12%] bg-mint-wash lp-bars-bg" aria-hidden />
        <div className="absolute left-[28%] right-[10%] top-[31%] bottom-[16%] border border-ink/25 bg-white/40" aria-hidden />
        <p className="absolute left-[29%] top-[28.5%] text-xs">Tech Adviser</p>
        {/* diagram nodes */}
        <div className={`${box} left-[8%] top-[48%] h-[8%] w-[16%] bg-white`}>Ваша 1С</div>
        <div className={`${box} left-[30%] top-[38%] h-[22%] w-[15%] border-dashed`}><span>Connector Agent<br /><b className="font-normal text-ink/50">у вас</b></span></div>
        <div className={`${box} left-[30%] top-[63%] h-[14%] w-[15%] border-dashed`}><span>Integration Gateway</span></div>
        <div className={`${box} left-[49%] top-[36%] h-[40%] w-[20%] flex-col justify-start gap-0 p-0`}>
          <span className="w-full border-b border-ink/30 bg-mint-wash py-1">Облачная PostgreSQL</span>
          {['Raw', 'Staging', 'Core', 'Marts'].map((l) => <span key={l} className="flex w-full flex-1 items-center justify-center border-b border-ink/20 bg-[#cfe3d8]/70 last:border-0">{l}</span>)}
        </div>
        <div className={`${box} left-[73%] top-[36%] h-[11%] w-[15%] bg-white`}>Аналитика / KPI</div>
        <div className={`${box} left-[73%] top-[51%] h-[11%] w-[15%] bg-white`}>AI-аналитик · Qdrant</div>
        <div className={`${box} left-[73%] top-[66%] h-[11%] w-[15%] bg-white`}>Excel-отчёты</div>
        <svg viewBox="0 0 1000 640" className="pointer-events-none absolute inset-0 h-full w-full" fill="none" aria-hidden>
          {[
            'M240 310 H300', 'M450 270 H490', 'M375 420 V400', 'M450 460 H490', 'M690 290 H730', 'M690 350 H730', 'M690 450 H730',
          ].map((d) => <path key={d} d={d} stroke="#0b0d0c" strokeOpacity=".5" strokeWidth="1.2" className="dash-flow" />)}
          {CALLOUTS.map((c) => <circle key={c.id} cx={c.at[0] * 10} cy={c.at[1] * 6.4} r="5" fill="#34d59a" stroke="#0b0d0c" />)}
        </svg>
        {CALLOUTS.map((c) => <div key={c.id} className={`absolute w-[22%] ${c.pos}`}><Callout c={c} /></div>)}
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:hidden">{CALLOUTS.map((c) => <Callout key={c.id} c={c} />)}</div>
      <ol className="mt-6 flex flex-wrap items-center gap-2 font-mono text-xs text-ink/70 lg:hidden"><li>1С</li><li>→ Агент</li><li>→ Gateway</li><li>→ PostgreSQL</li><li>→ Аналитика · AI · Отчёты</li></ol>

      <p className="mt-6 max-w-[760px] text-[15px] leading-snug text-ink-soft"><span className="text-ink">Архитектура</span> разделяет сбор данных, хранение и аналитику: Connector Agent у вас, облачная аналитическая PostgreSQL для каждого клиента, расчёты — детерминированные.</p>
    </section>
  )
}
