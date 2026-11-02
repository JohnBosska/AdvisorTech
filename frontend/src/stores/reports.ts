import { create } from 'zustand'
import type { RunState } from '../components/ui/StatusBadge'
import type { ReportKind } from '../mocks/data'
import { REPORT_KINDS } from '../mocks/data'

// DEMO report lifecycle (queued → processing → ready). Real reports are generated server-side.
export interface DemoReport { id: string; kind: ReportKind; title: string; period: string; createdAt: string; state: RunState; note?: string }

interface ReportsState {
  reports: DemoReport[]
  create: (kind: ReportKind, period: string, title?: string) => string
}

const seed: DemoReport[] = [
  { id: 'r-seed-3', kind: 'executive', title: 'Резюме для собственника', period: 'сентябрь 2026', createdAt: '2026-10-02T07:00:00Z', state: 'ready' },
  { id: 'r-seed-2', kind: 'financial', title: 'Финансовая отчётность (ориентирована на РСБУ)', period: 'III квартал 2026', createdAt: '2026-10-05T09:30:00Z', state: 'failed', note: 'Не сопоставлены счета 44.03 и 91.02. Исправьте сопоставление и повторите.' },
  { id: 'r-seed-1', kind: 'inventory', title: 'Запасы и склады', period: 'август 2026', createdAt: '2026-09-01T07:00:00Z', state: 'expired', note: 'Срок хранения файла истёк. Сформируйте отчёт заново.' },
]

export const useReports = create<ReportsState>((set) => ({
  reports: seed,
  create: (kind, period, title) => {
    const id = `r-${Date.now()}`
    const label = title ?? REPORT_KINDS.find((k) => k.id === kind)!.label
    const patch = (state: RunState) => set((s) => ({ reports: s.reports.map((r) => (r.id === id ? { ...r, state } : r)) }))
    set((s) => ({ reports: [{ id, kind, title: label, period, createdAt: new Date().toISOString(), state: 'queued' }, ...s.reports] }))
    setTimeout(() => patch('processing'), 900)
    setTimeout(() => patch('ready'), 3200)
    return id
  },
}))
