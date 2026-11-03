import { lazy, Suspense } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Database, MessagesSquare, Search, Sparkles } from 'lucide-react'
import { useAuth } from '../../../lib/auth/AuthProvider'

const BrainLaptop = lazy(() => import('../../../components/3d/BrainLaptop'))

const CAPS = [
  { icon: Database, title: 'Накопление знаний', text: 'Собирает документы компании в базу знаний. Подключение данных 1С — в разработке.' },
  { icon: Search, title: 'RAG-поиск', text: 'Находит релевантный контекст только в данных вашей организации.' },
  { icon: Sparkles, title: 'ИИ-рассуждение', text: 'Формулирует ответ по найденным источникам и проверяет ссылки и числа.' },
  { icon: MessagesSquare, title: 'Аналитика в диалоге', text: 'Знания компании доступны в чате, с историей и выгрузкой в Excel.' },
]

// distant structures + floating particles: deterministic, purely decorative
const BEAMS = [8, 15, 22, 61, 69, 77, 84, 91].map((x, i) => ({ x, h: 34 + ((i * 37) % 38), d: -(i * 3.1) }))
const DUST = Array.from({ length: 22 }, (_, i) => ({ x: (i * 47) % 100, y: 8 + ((i * 29) % 80), s: 1 + (i % 3), d: -(i * 2.3), a: 0.25 + (i % 4) * 0.12, warm: i % 6 === 0 }))

function Backdrop() {
  return (
    <div className="scene" aria-hidden>
      <div className="scene-emerald scene-e1" />
      <div className="scene-emerald scene-e2" />
      <div className="scene-amber" />
      <div className="scene-rays" />
      {BEAMS.map((b, i) => <i key={i} className="scene-beam" style={{ left: `${b.x}%`, height: `${b.h}%`, animationDelay: `${b.d}s` }} />)}
      {DUST.map((p, i) => <i key={i} className={`scene-dust${p.warm ? ' warm' : ''}`} style={{ left: `${p.x}%`, top: `${p.y}%`, width: p.s, height: p.s, opacity: p.a, animationDelay: `${p.d}s` }} />)}
      <div className="scene-vignette" />
      <div className="cine-grain" />
    </div>
  )
}

export function DigitalBrain() {
  const { isAuthenticated } = useAuth()
  return (
    <section id="brain" className="cine-brain relative isolate overflow-hidden">
      <Backdrop />
      <div className="relative mx-auto max-w-[1280px] px-4 pb-20 pt-8 sm:px-6 lg:pb-24 lg:pt-4">
        <div className="grid items-center gap-6 lg:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)] lg:gap-0">
          <div className="relative z-10 lg:pr-4">
            <p className="mb-6 font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--soft-gold)]/85">Digital Brain / RAG AI</p>
            <h2 className="lp-display text-[clamp(2.2rem,4.8vw,4rem)] text-[var(--warm-white)]">Единый интеллект для вашего бизнеса.</h2>
            <p className="mt-6 max-w-[470px] text-[16px] leading-relaxed text-[#9db5a9]">
              Объединяем документы, данные и корпоративные знания в единую RAG AI-систему, которая понимает контекст вашего бизнеса и помогает находить точные ответы.
            </p>
            <Link to={isAuthenticated ? '/app/ai-analyst' : '/register'} className="cine-btn-primary group mt-9 inline-flex items-center gap-2 rounded-full px-7 py-3 text-sm font-medium">
              {isAuthenticated ? 'Открыть ИИ-аналитика' : 'Попробовать'}<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
            </Link>
          </div>
          <div className="relative lg:-mr-10 lg:-mt-6">
            <Suspense fallback={null}><BrainLaptop /></Suspense>
          </div>
        </div>
        <ul className="relative z-10 mt-6 grid gap-x-8 gap-y-7 sm:grid-cols-2 lg:mt-10 lg:grid-cols-4">
          {CAPS.map(({ icon: Icon, title, text }) => (
            <li key={title} className="border-t border-[var(--soft-mint)]/15 pt-4">
              <Icon className="h-4 w-4 text-[var(--bright-emerald)]" aria-hidden />
              <h3 className="mt-3 text-[15px] font-medium text-[var(--warm-white)]">{title}</h3>
              <p className="mt-1.5 text-[14px] leading-relaxed text-[#8aa398]">{text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
