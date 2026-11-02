import { Label, TwoTone } from './Blocks'
import { useInView } from './useInView'

const SEGMENTS = ['Оптовая торговля', 'Розничные сети', 'E-commerce', 'Импортёры', 'Лёгкое производство', 'Дистрибуция', 'Несколько складов', 'Несколько юрлиц']

/** Fan of "window" cards along an arc, like Neon's customer-logo stack; spreads out when it enters the viewport. */
function WindowFan() {
  const [ref, on] = useInView<HTMLDivElement>({ margin: '0px 0px -10% 0px' })
  const n = SEGMENTS.length
  return (
    <div ref={ref} className="relative mx-auto mt-10 h-[300px] w-full max-w-[1040px] sm:h-[340px]" aria-label="Для каких компаний подходит продукт" role="list">
      {SEGMENTS.map((s, i) => {
        const k = i - (n - 1) / 2
        const x = on ? k * 118 : 0
        const y = on ? Math.abs(k) * Math.abs(k) * 7 : 0
        const rot = on ? k * 4.5 : 0
        return (
          <div key={s} role="listitem" className="absolute left-1/2 top-4 w-[136px] origin-bottom border-2 border-[#3a3d40] bg-[#0f1011] text-white shadow-xl transition-all duration-[900ms] ease-[cubic-bezier(.2,.7,.2,1)] hover:z-20 hover:-translate-y-2 sm:w-[150px]" style={{ transform: `translate(calc(-50% + ${x}px), ${y}px) rotate(${rot}deg)`, zIndex: i < n / 2 ? i : n - i, transitionDelay: `${i * 40}ms` }}>
            <div className="flex items-center justify-between border-b border-[#2a2d30] bg-[#1b1d1f] px-2 py-1 font-mono text-[9px] text-[#9aa09c]"><span>segment.{String(i + 1).padStart(2, '0')}</span><span>▫</span></div>
            <div className="grid h-[92px] place-items-center px-2 text-center text-[13px] leading-tight [background-image:radial-gradient(rgb(255_255_255/.07)_1px,transparent_1px)] [background-size:6px_6px]">{s}</div>
          </div>
        )
      })}
    </div>
  )
}

const Stat = ({ k, text, meta }: { k: string; text: string; meta: string }) => (
  <div className="border border-white/20 p-8">
    <p className="font-mono text-xs text-ink-soft">{meta}</p>
    <p className="mt-10 text-[clamp(2.5rem,5vw,4rem)] font-light leading-none tracking-tight text-ink/60">{k}</p>
    <p className="mt-6 max-w-[260px] text-[15px] leading-snug text-ink/60">{text}</p>
  </div>
)

export function ScaleSection() {
  return (
    <section className="mx-auto max-w-[1180px] px-4 py-24 sm:px-6">
      <Label>Масштабируйте аналитику</Label>
      <p className="lp-num mt-6" aria-hidden>03</p>
      <TwoTone lead="От первой базы до нескольких складов и юрлиц." className="mt-10 max-w-[900px]">{'Начните с одной конфигурации 1С и расширяйте охват по мере проверки данных.'}</TwoTone>

      <div className="mt-16 grid gap-10 lg:grid-cols-[1fr_1.3fr]">
        <div>
          <h3 className="font-mono text-[clamp(1.4rem,2.4vw,2rem)] uppercase leading-tight tracking-tight text-[#7f8a85]">Где это нужнее всего</h3>
          <p className="mt-3 max-w-[300px] font-mono text-[11px] uppercase leading-relaxed tracking-wide text-[#7f8a85]">Компании с товарными группами, запасами и складами.</p>
        </div>
        <Stat meta="Интеграция" k="Только чтение" text="Запись в 1С не выполняется: платформа создаёт аналитическую копию данных." />
      </div>
      <WindowFan />
      <div className="mt-6 grid gap-10 lg:grid-cols-[1fr_1.3fr]">
        <div>
          <h3 className="font-mono text-[clamp(1.4rem,2.4vw,2rem)] uppercase leading-tight tracking-tight text-[#7f8a85]">Где важна прослеживаемость</h3>
          <p className="mt-3 max-w-[300px] font-mono text-[11px] uppercase leading-relaxed tracking-wide text-[#7f8a85]">Каждое число можно проследить до источника.</p>
        </div>
        <Stat meta="Данные" k="4 слоя" text="Raw → Staging → Core → Marts: происхождение, версии сопоставления и расчёта сохраняются." />
      </div>
    </section>
  )
}
