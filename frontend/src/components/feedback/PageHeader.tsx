import type { ReactNode } from 'react'
import { DemoBadge } from './Feedback'

export function PageHeader({ title, description, demo = true, actions }: { title: string; description?: string; demo?: boolean; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <div className="flex items-center gap-3"><h1 className="text-2xl font-semibold tracking-tight sm:text-[28px]">{title}</h1>{demo && <DemoBadge />}</div>
        {description && <p className="mt-1.5 max-w-2xl text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
