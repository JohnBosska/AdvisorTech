import { lazy, Suspense } from 'react'
import { Database, Search, Sparkles, MessagesSquare } from 'lucide-react'

const BrainLaptop = lazy(() => import('../../../components/3d/BrainLaptop'))

const CAPS = [
  { icon: Database, title: 'Накопление знаний', text: 'Собирает документы компании в базу знаний. Подключение данных 1С — в разработке.' },
  { icon: Search, title: 'RAG-поиск', text: 'Находит релевантный контекст только в данных вашей организации.' },
  { icon: Sparkles, title: 'ИИ-рассуждение', text: 'Формулирует ответ по найденным источникам и проверяет ссылки и числа.' },
  { icon: MessagesSquare, title: 'Бизнес-аналитика в диалоге', text: 'Знания компании доступны в обычном чате, с историей и выгрузкой в Excel.' },
]

export function DigitalBrain() {
  return (
    <section id="brain" className="cine-brain relative isolate overflow-hidden">
      <div className="cine-brain-glow" aria-hidden />
      <div className="relative mx-auto grid max-w-[1180px] items-center gap-12 px-4 py-24 sm:px-6 lg:grid-cols-[1fr_1.05fr] lg:gap-8 lg:py-32">
        <div>
          <p className="mb-5 font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--cine-champagne)]/80">Цифровой мозг</p>
          <h2 className="lp-display text-[clamp(2rem,4.4vw,3.4rem)] text-[var(--cine-white)]">Встречайте цифровой мозг вашей компании.</h2>
          <p className="mt-6 max-w-[520px] text-[16px] leading-relaxed text-[var(--cine-white)]/65">
            Не очередной ИИ-помощник, а единый слой интеллекта: он понимает знания компании, связывает информацию и отвечает в контексте ваших данных — с источниками, которые можно открыть и проверить.
          </p>
          <p className="mt-4 max-w-[520px] text-[16px] font-medium leading-relaxed text-[var(--cine-white)]">Знания компании становятся связанной, доступной для поиска системой, в которой можно задать вопрос.</p>
          <ul className="mt-10 grid gap-x-8 gap-y-7 sm:grid-cols-2">
            {CAPS.map(({ icon: Icon, title, text }) => (
              <li key={title} className="border-t border-white/10 pt-4">
                <Icon className="h-4 w-4 text-[var(--cine-lime)]" aria-hidden />
                <h3 className="mt-3 text-[15px] font-medium text-[var(--cine-white)]">{title}</h3>
                <p className="mt-1.5 text-[14px] leading-relaxed text-[var(--cine-white)]/55">{text}</p>
              </li>
            ))}
          </ul>
        </div>
        <div className="relative order-last h-[360px] sm:h-[460px] lg:h-[540px]">
          <Suspense fallback={null}><BrainLaptop /></Suspense>
        </div>
      </div>
    </section>
  )
}
