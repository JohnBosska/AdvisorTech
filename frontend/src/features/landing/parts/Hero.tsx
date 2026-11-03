import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { LightStructures } from './LightStructures'

const STRIP = ['1С:Бухгалтерия', '1С:Управление торговлей', '1С:ERP', 'PostgreSQL', 'pgvector', 'MS SQL Server', 'Temporal']

export function Hero({ authed }: { authed: boolean }) {
  return (
    <section className="cine-hero relative isolate overflow-hidden">
      <LightStructures />
      <div className="relative mx-auto flex min-h-[min(88vh,820px)] max-w-[1180px] flex-col justify-center px-4 pb-24 pt-20 sm:px-6 lg:pb-32">
        <p className="mb-7 font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--cine-champagne)]/80">Ваш бизнес. Одна умная система.</p>
        <h1 className="lp-display max-w-[900px] text-[clamp(2.6rem,7vw,5.8rem)] text-[var(--cine-white)]">
          Вся экспертиза вашего бизнеса. <span className="text-[var(--cine-white)]/55">В одной интеллектуальной системе.</span>
        </h1>
        <p className="mt-8 max-w-[600px] text-[17px] leading-relaxed text-[var(--cine-white)]/65">
          Объединяем документы, данные и корпоративные знания в единую AI-экосистему, которая находит нужную информацию, понимает контекст и помогает принимать решения.
        </p>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
          <a href="#brain" className="cine-btn-primary group inline-flex items-center justify-center gap-2 rounded-full px-7 py-3 text-sm font-medium">
            Познакомиться с цифровым мозгом<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
          </a>
          <a href="#how" className="cine-btn-ghost inline-flex items-center justify-center rounded-full px-7 py-3 text-sm">Как это работает</a>
          <Link to={authed ? '/app' : '/register'} className="px-2 py-3 text-sm text-[var(--cine-white)]/60 underline-offset-4 transition-colors hover:text-[var(--cine-white)] hover:underline">{authed ? 'Открыть кабинет' : 'Создать рабочее пространство'}</Link>
        </div>
      </div>
      <ul className="relative mx-auto flex max-w-[1180px] flex-wrap items-center justify-center gap-x-10 gap-y-4 border-t border-white/10 px-4 py-8 sm:px-6" aria-label="Совместимость">
        {STRIP.map((s) => <li key={s} className="font-mono text-[13px] tracking-tight text-[var(--cine-white)]/45">{s}</li>)}
      </ul>
    </section>
  )
}
