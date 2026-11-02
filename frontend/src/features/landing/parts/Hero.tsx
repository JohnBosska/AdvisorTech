import { ArrowRight } from 'lucide-react'
import { lazy, Suspense } from 'react'
import { Link } from 'react-router-dom'
import { PRODUCT_NAME } from '../../../config/brand'
import { LogoMark } from '../../../components/navigation/Wordmark'
import { BarsCanvas } from './BarsCanvas'

const BrainLaptop = lazy(() => import('../../../components/3d/BrainLaptop'))
const STRIP = ['1С:Бухгалтерия', '1С:Управление торговлей', '1С:ERP', 'PostgreSQL', 'MS SQL Server', 'Qdrant', 'Temporal']

export function Hero({ authed }: { authed: boolean }) {
  return (
    <section>
      <div className="mx-auto max-w-[1180px] px-4 sm:px-6">
        <div className="relative isolate min-h-[620px] overflow-hidden bg-black lg:min-h-[560px]">
          <BarsCanvas />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" aria-hidden />
          <div className="absolute right-0 top-0 h-[58%] w-full lg:h-full lg:w-[55%]">
            <Suspense fallback={null}><BrainLaptop /></Suspense>
          </div>
          <div className="relative flex min-h-[620px] flex-col justify-end p-6 sm:p-10 lg:min-h-[560px]">
            <p className="mb-5 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-[#9aa09c]"><LogoMark className="h-4 w-4" />{PRODUCT_NAME} · AI-аналитика поверх 1С</p>
            <h1 className="max-w-[760px] text-[clamp(2.1rem,4.6vw,3.6rem)] font-normal leading-[1.08] tracking-[-0.03em] text-[#dfe3df]">
              Платформа бизнес-аналитики для МСП,<br className="hidden sm:inline" /> построенная на данных <a href="#how" className="underline decoration-1 underline-offset-[6px] hover:text-white">вашей 1С</a>.
            </h1>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-6 py-6">
          <Link to={authed ? '/app' : '/register'} className="group inline-flex items-center gap-2 text-sm font-medium">{authed ? 'Открыть кабинет' : 'Начать'}<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden /></Link>
          <a href="#how" className="rounded-full border border-ink/50 px-6 py-2.5 text-sm text-ink/70 transition-colors hover:border-ink hover:text-ink">Как это работает</a>
        </div>
        <div className="border-t border-ink/60" />
        <ul className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4 py-9 text-[15px] font-medium text-ink/55" aria-label="Совместимость">
          {STRIP.map((s) => <li key={s} className="font-mono text-[13px] tracking-tight">{s}</li>)}
        </ul>
      </div>
    </section>
  )
}
