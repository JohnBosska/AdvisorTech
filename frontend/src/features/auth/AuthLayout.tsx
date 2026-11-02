import type { ReactNode } from 'react'
import { Wordmark } from '../../components/navigation/Wordmark'

export function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-10">
      <div className="grid-bg pointer-events-none absolute inset-0" aria-hidden />
      <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: 'var(--gradient-glow)' }} aria-hidden />
      <header className="relative mb-8"><Wordmark /></header>
      <main className="rise relative w-full max-w-sm rounded-[var(--radius-lg)] border border-border bg-surface-1/90 p-6 sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-2 text-sm text-muted">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </main>
      {footer && <p className="relative mt-6 text-sm text-muted">{footer}</p>}
    </div>
  )
}
