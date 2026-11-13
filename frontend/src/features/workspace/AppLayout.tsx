import { Bot, Cable, CreditCard, Database, FileBarChart, FileSpreadsheet, LayoutDashboard, LogOut, PanelLeftClose, PanelLeftOpen, Settings, LayoutGrid, ScrollText } from 'lucide-react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { DemoBadge } from '../../components/feedback/Feedback'
import { LogoMark, Wordmark } from '../../components/navigation/Wordmark'
import { PeriodSelector } from '../../components/navigation/PeriodSelector'
import { useActiveOrganization } from '../../lib/api/hooks'
import { useAuth } from '../../lib/auth/AuthProvider'
import { formatDateTime } from '../../lib/format'
import { DEMO_AS_OF } from '../../mocks/data'
import { useUi } from '../../stores/ui'

const NAV = [
  { to: '/app', label: 'Обзор', icon: LayoutDashboard, end: true },
  { to: '/app/ai-analyst', label: 'AI-аналитик', icon: Bot },
  { to: '/app/bi', label: 'BI-студия', icon: LayoutGrid },
  { to: '/app/financial-reports', label: 'Финансовая отчётность', icon: FileBarChart },
  { to: '/app/integrations', label: 'Интеграции 1С', icon: Cable },
  { to: '/app/data-infrastructure', label: 'Инфраструктура данных', icon: Database },
  { to: '/app/reports', label: 'Отчёты', icon: FileSpreadsheet },
  { to: '/app/subscription', label: 'Подписка', icon: CreditCard },
  { to: '/app/audit', label: 'Аудит', icon: ScrollText, roles: ['OWNER', 'IT_ADMIN'] },
  { to: '/app/settings', label: 'Настройки', icon: Settings },
] as { to: string; label: string; icon: typeof Settings; end?: boolean; roles?: string[] }[]

export function AppLayout() {
  const { user, signOut } = useAuth()
  const { organization } = useActiveOrganization()
  const nav = NAV.filter((n) => !n.roles || (organization && n.roles.includes(organization.role)))
  const { sidebarCollapsed, toggleSidebar } = useUi()
  const fullBleed = /^\/app\/(ai-analyst|bi)/.test(useLocation().pathname)

  return (
    <div className="flex min-h-screen">
      <aside className={`sticky top-0 hidden h-screen shrink-0 flex-col border-r border-border bg-surface-1/60 transition-[width] duration-200 md:flex ${sidebarCollapsed ? 'w-[60px]' : 'w-60'}`}>
        <div className="flex h-14 items-center px-4">{sidebarCollapsed ? <LogoMark className="h-7 w-7" /> : <Wordmark to="/app" />}</div>
        <nav aria-label="Разделы" className="flex-1 space-y-0.5 overflow-y-auto px-2 py-2">
          {nav.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} title={sidebarCollapsed ? label : undefined} className={({ isActive }) => `flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 text-[13px] transition-colors ${isActive ? 'bg-surface-3 text-accent' : 'text-muted hover:bg-surface-2 hover:text-white'}`}>
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              {!sidebarCollapsed && <span className="truncate">{label}</span>}
              {sidebarCollapsed && <span className="sr-only">{label}</span>}
            </NavLink>
          ))}
        </nav>
        <button type="button" onClick={toggleSidebar} aria-label={sidebarCollapsed ? 'Развернуть меню' : 'Свернуть меню'} className="m-2 flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 text-[13px] text-muted hover:bg-surface-2 hover:text-white">
          {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          {!sidebarCollapsed && 'Свернуть'}
        </button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-black/80 px-4 backdrop-blur-md sm:px-6">
          <Link to="/app" aria-label="Tech Adviser" className="md:hidden"><LogoMark className="h-7 w-7" /></Link>
          <div className="hidden min-w-0 md:block">
            <p className="truncate text-sm font-medium">{organization?.name ?? 'Рабочее пространство'}</p>
          </div>
          <div className="ml-auto flex min-w-0 items-center gap-2 sm:gap-3">
            <span className="hidden font-mono text-[11px] text-muted lg:inline" title="Время последней загрузки данных (демо)">Обновлено {formatDateTime(DEMO_AS_OF)}</span>
            <DemoBadge className="hidden sm:inline-flex" />
            <PeriodSelector />
            <span className="hidden max-w-[140px] truncate text-[13px] text-muted lg:inline">{user?.name ?? `Пользователь #${user?.id ?? ''}`}</span>
            <button type="button" onClick={signOut} aria-label="Выйти" className="rounded p-1.5 text-muted hover:bg-surface-3 hover:text-white"><LogOut className="h-4 w-4" /></button>
          </div>
        </header>
        <nav aria-label="Разделы (мобильные)" className="flex gap-1 overflow-x-auto border-b border-border px-3 py-2 md:hidden">
          {nav.map(({ to, label, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => `whitespace-nowrap rounded-full px-3 py-1 text-xs ${isActive ? 'bg-surface-3 text-accent' : 'text-muted'}`}>{label}</NavLink>
          ))}
        </nav>
        <main className={fullBleed ? 'w-full flex-1' : 'mx-auto w-full max-w-[1280px] flex-1 p-4 sm:p-6'}><Outlet /></main>
      </div>
    </div>
  )
}
