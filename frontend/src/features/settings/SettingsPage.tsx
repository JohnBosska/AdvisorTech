import { PageHeader } from '../../components/feedback/PageHeader'
import { LoadingState } from '../../components/feedback/Feedback'
import { Button } from '../../components/ui/Button'
import { SelectField } from '../../components/ui/Field'
import { useActiveOrganization } from '../../lib/api/hooks'
import { useAuth } from '../../lib/auth/AuthProvider'
import { formatDate } from '../../lib/format'
import { PERIODS } from '../../mocks/data'
import { ThemeSwitcher } from '../../components/ui/ThemeSwitcher'
import { useUi } from '../../stores/ui'

const ROLE = { OWNER: 'Владелец', FINANCE: 'Финансы / бухгалтерия', ANALYST: 'Аналитик', IT_ADMIN: 'IT-администратор' } as const

function Rows({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <section className="rounded-[var(--radius-lg)] border border-border bg-surface-1">
      <h2 className="border-b border-border px-5 py-3 text-[15px] font-medium">{title}</h2>
      <dl className="divide-y divide-border">{rows.map(([k, v]) => <div key={k} className="flex justify-between gap-4 px-5 py-3 text-sm"><dt className="text-muted">{k}</dt><dd className="tabular text-right">{v}</dd></div>)}</dl>
    </section>
  )
}

export function SettingsPage() {
  const { user, signOut } = useAuth()
  const { organization, isPending } = useActiveOrganization()
  const { period, setPeriod, sidebarCollapsed, toggleSidebar } = useUi()
  if (isPending) return <LoadingState />
  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader demo={false} title="Настройки" description="Профиль и рабочее пространство. Профиль пока доступен только для чтения." />
      <Rows title="Профиль" rows={[['ID', user ? String(user.id) : '—'], ['Имя', user?.name ?? '—'], ['Телефон', user?.phone ?? '—'], ['Дата рождения', formatDate(user?.birthday_date)]]} />
      <Rows title="Организация" rows={organization ? [['Название', organization.name], ['Юридическое название', organization.legal_name ?? '—'], ['ИНН', organization.tax_id ?? '—'], ['Валюта отчётности', organization.reporting_currency], ['Использует 1С', organization.uses_onec === null ? 'не указано' : organization.uses_onec ? 'да' : 'нет'], ['Ваша роль', ROLE[organization.role]]] : [['Статус', 'Организация не создана']]} />
      <section className="space-y-4 rounded-[var(--radius-lg)] border border-border bg-surface-1 p-5">
        <h2 className="text-[15px] font-medium">Интерфейс</h2>
        <div className="flex flex-wrap items-center justify-between gap-3"><span className="text-[13px] text-text-soft">Тема интерфейса</span><ThemeSwitcher withLabels /></div>
        <SelectField label="Период по умолчанию" value={period} onChange={(e) => setPeriod(e.target.value as typeof period)}>{PERIODS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}</SelectField>
        <Button variant="secondary" size="sm" onClick={toggleSidebar}>{sidebarCollapsed ? 'Развернуть боковое меню' : 'Свернуть боковое меню'}</Button>
      </section>
      <Button variant="danger" onClick={signOut}>Выйти из аккаунта</Button>
    </div>
  )
}
