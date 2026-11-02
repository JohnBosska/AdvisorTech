import { Check } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Label, TwoTone } from './Blocks'
import { prefersReducedMotion, useInView } from './useInView'

const POINTS = [
  { t: 'Ответ с расчётом', d: 'Числа считают SQL/Python по утверждённым витринам. AI их объясняет, а не придумывает.' },
  { t: 'Факты отдельно от гипотез', d: 'В ответе видно: что измерено, что интерпретация и какие есть допущения и ограничения.' },
  { t: 'Решения остаются за человеком', d: 'Платформа предлагает действия, но ничего не меняет в 1С и не принимает решений за вас.' },
]
const STEPS = ['Расчёт KPI по определению', 'Сверка с источником', 'Ссылки на данные']

export function VerifyFlow() {
  const [ref, on] = useInView<HTMLDivElement>({ repeat: true, margin: '0px' })
  const [tick, setTick] = useState(0)
  const reduced = prefersReducedMotion()
  useEffect(() => {
    if (!on || reduced) return
    const id = setInterval(() => setTick((x) => x + 1), 900)
    return () => clearInterval(id)
  }, [on, reduced])
  const n = reduced ? STEPS.length + 1 : on ? tick % (STEPS.length + 4) : 0

  return (
    <section id="how" className="mx-auto max-w-[1180px] px-4 py-24 sm:px-6">
      <Label>Работайте с AI безопасно</Label>
      <p className="lp-num mt-6" aria-hidden>02</p>
      <TwoTone lead="Готов к вопросам собственника." className="mt-10 max-w-[900px]">{'Спросите на обычном языке — получите расчёт, источники и честное «данных недостаточно».'}</TwoTone>
      <div ref={ref} className="mt-14 grid gap-10 lg:grid-cols-[1fr_1fr]">
        <ul className="space-y-8 lg:max-w-md">{POINTS.map((p) => <li key={p.t}><p className="text-sm text-ink-soft">{p.t}</p><p className="mt-1.5 text-[15px] leading-snug">{p.d}</p></li>)}</ul>
        <div className="relative min-h-[520px] overflow-hidden" aria-hidden>
          <div className="absolute inset-y-0 left-[6%] right-[6%] grid grid-cols-8">{Array.from({ length: 8 }, (_, i) => <i key={i} className="border-l border-white/10" />)}</div>
          <div className="relative mx-auto mt-0 w-[78%] border border-white/20 bg-paper">
            <div className="border-b border-white/10 px-3 py-2 text-[13px] text-ink/70">Вопрос собственника</div>
            <p className="px-3 py-3 text-[13px] text-ink-soft">В какой группе самая низкая валовая маржа?</p>
            <p className="px-3 text-xs text-ink/60">{n >= 1 ? 'Обработано за 2 с ›' : 'Считаю…'}</p>
            <div className="m-3 mt-2 border border-white/20 p-2.5 text-[13px] text-ink/60">Задать уточняющий вопрос…</div>
          </div>
          <svg viewBox="0 0 300 330" className="absolute inset-x-0 bottom-0 mx-auto h-[330px] w-[78%]" fill="none">
            <path d="M150 0 V120 M150 120 C150 160 160 170 190 172" stroke="#17895c" strokeOpacity=".6" strokeWidth="1.5" style={{ ['--len' as string]: 400, strokeDasharray: 400, animation: on ? 'draw 1.6s ease-out forwards' : undefined }} />
            <path d="M150 120 C150 170 150 330 150 330" stroke="#17895c" strokeOpacity=".6" strokeWidth="1.5" />
          </svg>
          <ul className="absolute bottom-6 left-1/2 w-[70%] -translate-x-[12%] space-y-9 bg-transparent text-[13px]">
            {STEPS.map((s, i) => (
              <li key={s} className="flex items-center gap-3">
                <span className={`grid h-5 w-5 place-items-center border border-ink transition-colors duration-300 ${n > i + 1 ? 'bg-accent' : 'bg-paper'}`}>{n > i + 1 && <Check className="h-3.5 w-3.5" strokeWidth={3} />}</span>
                <span className={n > i ? 'text-ink' : 'text-ink/35'}>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
