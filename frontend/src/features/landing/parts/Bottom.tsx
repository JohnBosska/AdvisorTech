import { Link } from 'react-router-dom'
import { Label } from './Blocks'
import { PLAN_WIDGETS } from './PlanWidgets'

const PLAN = [
  { icon: 'burst', t: 'Интеграция с 1С', d: 'Поддерживаемые конфигурации, только чтение, агент у вас.' },
  { icon: 'ring', t: 'Облачная PostgreSQL', d: 'Отдельная аналитическая среда, миграции и бэкапы на стороне платформы.' },
  { icon: 'bars', t: 'Сквозная аналитика', d: 'Товарные группы, запасы, склады, логистика и отчётность для собственника.' },
  { icon: 'wave', t: 'AI и Excel-отчёты', d: 'Ответы с расчётами, рекомендации и книги Excel с методологией.' },
] as const

export function Pricing({ authed }: { authed: boolean }) {
  return (
    <section id="plan" className="mx-auto max-w-[1180px] px-4 py-20 sm:px-6">
      <Label>Премиальная подписка</Label>
      <h2 className="mt-5 max-w-[900px] text-[clamp(1.8rem,3.6vw,3rem)] font-normal leading-[1.1] tracking-[-0.03em]">Один тариф вместо нескольких систем и специалистов.</h2>
      <p className="mt-5 max-w-[600px] text-sm leading-relaxed text-ink/60">Стоимость, пробный период и лимиты ещё не определены — мы не показываем цен, пока они не утверждены. Условия пилота обсуждаем при подключении.</p>
      <Link to={authed ? '/app/subscription' : '/register'} className="mt-6 inline-block px-1 text-sm text-ink/50 hover:text-ink">Запросить условия пилота →</Link>
      <div className="mt-16 grid gap-x-12 gap-y-16 sm:grid-cols-2">
        {PLAN.map((p) => { const W = PLAN_WIDGETS[p.icon]; return <div key={p.t} className="flex flex-col px-1"><h3 className="text-[1.4rem] font-normal tracking-tight">{p.t}</h3><p className="mt-3 max-w-[420px] text-sm text-ink/60">{p.d}</p><div className="mt-auto pt-8"><W /></div></div> })}
      </div>
      <p className="mt-10 text-xs text-ink-soft">Виджеты — иллюстрации принципа, а не живые данные.</p>
    </section>
  )
}

export function FinalCta({ authed }: { authed: boolean }) {
  return (
    <section className="mx-auto max-w-[1180px] px-4 pb-20 pt-10 sm:px-6">
      <h2 className="max-w-[460px] text-[clamp(1.8rem,3vw,2.5rem)] font-normal leading-[1.08] tracking-[-0.03em] text-ink-soft">Понятная аналитика для вашего бизнеса.</h2>
      <p className="mt-24 max-w-[420px] text-[15px] leading-snug text-ink-soft">Подключите 1С и увидьте картину бизнеса в одном месте.<br />Начните с регистрации.</p>
      <div className="mt-8 flex flex-col items-center gap-5">
        <Link to={authed ? '/app' : '/register'} className="text-sm font-medium">{authed ? 'Открыть кабинет' : 'Начать'}</Link>
        <a href="#how" className="w-full rounded-full border border-white/20 py-3 text-center text-sm text-ink/60 hover:border-ink hover:text-ink">Как это работает</a>
        <code className="font-mono text-[13px] text-ink/70">$ techadviser connect --read-only</code>
      </div>
      <p className="mt-3 text-center text-[11px] text-ink-soft">Команда показана как иллюстрация: CLI пока не существует.</p>
    </section>
  )
}
