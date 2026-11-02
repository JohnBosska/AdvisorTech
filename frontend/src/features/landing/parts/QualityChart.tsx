import { useState } from 'react'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { useInView } from './useInView'

type Mode = 'without' | 'with'
const SERIES = [38, 52, 44, 60, 47, 58, 50, 55, 49, 118, 52, 57, 46, 61, 53]
const W = 1000, H = 300, LIMIT = 90
const x = (i: number) => (i / (SERIES.length - 1)) * W
const y = (v: number) => H - (v / 130) * H
const line = SERIES.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')

export function QualityChart() {
  const [mode, setMode] = useState<Mode>('without')
  const [ref, on] = useInView<HTMLDivElement>()
  const withQ = mode === 'with'
  return (
    <section className="mx-auto max-w-[1180px] px-4 pb-24 sm:px-6">
      <p className="max-w-[760px] text-[clamp(1.4rem,2.4vw,2rem)] leading-[1.2] tracking-[-0.02em]"><span className="text-ink-soft">Контроль качества данных работает рядом с аналитикой. </span>Подозрительный показатель не попадает в рекомендации молча.</p>
      <div role="tablist" aria-label="Режим" className="mt-8 inline-flex border border-ink/70 text-[13px]">
        {([['without', 'Без контроля'], ['with', 'С контролем качества']] as const).map(([k, l]) => <button key={k} role="tab" aria-selected={mode === k} onClick={() => setMode(k)} className={`px-4 py-2 transition-colors ${mode === k ? 'bg-ink text-white' : 'text-ink/50 hover:text-ink'}`}>{l}</button>)}
      </div>
      <div ref={ref} className="relative mt-10 bg-[#101211] p-0">
        <p className="absolute left-5 top-4 font-mono text-[11px] text-[#8a8f8c]" aria-hidden>{withQ ? 'С Tech Adviser' : 'Без контроля'} · иллюстрация, демо-данные</p>
        <svg viewBox={`0 0 ${W} ${H}`} className="h-[300px] w-full sm:h-[340px]" preserveAspectRatio="none" role="img" aria-label={withQ ? 'График: аномальное значение отмечено как требующее внимания' : 'График: аномальное значение попало в отчёт без проверки'}>
          <defs>
            <pattern id="dots" width="8" height="8" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="0.9" fill="#ffffff" fillOpacity=".12" /></pattern>
            <pattern id="vl" width="9" height="9" patternUnits="userSpaceOnUse"><path d="M1 0V9" stroke="#fff" strokeOpacity=".05" /></pattern>
          </defs>
          <rect width={W} height={H} fill="url(#vl)" />
          <line x1="0" x2={W} y1={y(LIMIT)} y2={y(LIMIT)} stroke="#fff" strokeOpacity=".35" />
          <path d={`${line} L${W},${H} L0,${H} Z`} fill={withQ ? '#1f4b3a' : '#2b1a1a'} fillOpacity=".7" />
          <path d={`${line} L${W},${H} L0,${H} Z`} fill="url(#dots)" />
          <path d={line} fill="none" stroke={withQ ? '#34d59a' : '#e8736f'} strokeWidth="1.6" style={{ strokeDasharray: 3200, strokeDashoffset: on ? 0 : 3200, transition: 'stroke-dashoffset 2.2s ease-out' }} />
          <circle cx={x(9)} cy={y(SERIES[9])} r="6" fill={withQ ? '#e6b85c' : '#e8736f'} />
        </svg>
        <div className="absolute right-4 top-14 w-[min(300px,70%)] border border-white/20 bg-[#17191a]/95 p-4 font-mono text-[13px] text-white sm:right-[8%]" aria-live="polite">
          <p className="flex items-center gap-2 text-[15px]">{withQ ? <CheckCircle2 className="h-4 w-4 text-accent" aria-hidden /> : <AlertTriangle className="h-4 w-4 text-danger" aria-hidden />}{withQ ? 'Требует внимания' : 'Ошибка попала в отчёт'}</p>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[12px]">
            <dt className="text-[#8a8f8c]">Показатель:</dt><dd className="text-right">Маржа, {withQ ? '118%' : '118%'}</dd>
            <dt className="text-[#8a8f8c]">Статус:</dt><dd className={`text-right ${withQ ? 'text-warning' : 'text-danger'}`}>{withQ ? 'исключён, сверка' : 'не проверен'}</dd>
          </dl>
        </div>
        <p className="border-t border-white/15 px-5 py-2.5 font-mono text-[10px] uppercase tracking-wide text-[#8a8f8c]">Значения вымышлены и показывают принцип</p>
      </div>
    </section>
  )
}
