import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Wordmark } from '../../components/navigation/Wordmark'
import { PRODUCT_NAME } from '../../config/brand'
import { useAuth } from '../../lib/auth/AuthProvider'
import { Architecture } from './parts/Architecture'
import { Pricing, FinalCta, Stack } from './parts/Bottom'
import { FeatureStrip } from './parts/FeatureStrip'
import { Hero } from './parts/Hero'
import { QualityChart } from './parts/QualityChart'
import { ScaleSection } from './parts/ScaleSection'
import { VerifyFlow } from './parts/VerifyFlow'

const NAV = [
  { href: '#product', label: 'Продукт' },
  { href: '#how', label: 'Как это работает' },
  { href: '#plan', label: 'Тариф' },
]

export function LandingPage() {
  const { isAuthenticated } = useAuth()
  const [menu, setMenu] = useState(false)

  return (
    <div className="lp min-h-screen overflow-x-clip">
      <p className="border-b border-white/20 px-4 py-2 text-center text-[13px] text-ink-soft">Платформа в разработке: часть экранов кабинета работает на демо-данных. <Link to="/register" className="underline underline-offset-2 hover:text-ink">Создать рабочее пространство</Link></p>
      <header className="mx-auto flex max-w-[1180px] items-center justify-between px-4 py-4 sm:px-6">
        <Wordmark className="text-ink" />
        <nav aria-label="Основная" className="hidden items-center gap-8 text-sm text-ink/70 md:flex">
          {NAV.map((n) => <a key={n.href} href={n.href} className="transition-colors hover:text-ink">{n.label}</a>)}
        </nav>
        <div className="hidden items-center gap-5 md:flex">
          {isAuthenticated ? <Link to="/app" className="rounded-[4px] bg-accent px-4 py-2 text-sm font-medium text-black">Кабинет</Link> : (<>
            <Link to="/login" className="text-sm text-ink/70 hover:text-ink">Войти</Link>
            <Link to="/register" className="rounded-[4px] bg-accent px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-accent-strong">Начать</Link>
          </>)}
        </div>
        <button type="button" className="h-9 border border-white/10 px-3 text-sm md:hidden" aria-expanded={menu} aria-controls="mm" onClick={() => setMenu((o) => !o)}>Меню</button>
      </header>
      {menu && (
        <nav id="mm" aria-label="Мобильное меню" className="mx-4 mb-3 flex flex-col gap-3 border border-white/10 bg-surface-1 p-4 text-sm md:hidden">
          {NAV.map((n) => <a key={n.href} href={n.href} onClick={() => setMenu(false)}>{n.label}</a>)}
          <Link to="/login">Войти</Link><Link to="/register" className="font-medium">Начать</Link>
        </nav>
      )}
      <main>
        <Hero authed={isAuthenticated} />
        <FeatureStrip />
        <VerifyFlow />
        <ScaleSection />
        <Architecture />
        <QualityChart />
        <Stack />
        <Pricing authed={isAuthenticated} />
        <FinalCta authed={isAuthenticated} />
      </main>
      <footer className="border-t border-white/20">
        <div className="mx-auto max-w-[1180px] px-4 py-10 text-[13px] text-ink/60 sm:px-6">
          <Wordmark className="text-ink" />
          <p className="mt-4 max-w-[520px]">© {new Date().getFullYear()} {PRODUCT_NAME}. Платформа — слой аналитики и поддержки решений поверх 1С; не заменяет 1С и не является аудиторским заключением.</p>
        </div>
      </footer>
    </div>
  )
}
