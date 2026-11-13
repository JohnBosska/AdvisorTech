import { lazy, Suspense, type ReactNode } from 'react'
import { createBrowserRouter, Link, Navigate } from 'react-router-dom'
import { LoadingState } from '../components/feedback/Feedback'
import { LoginPage } from '../features/auth/LoginPage'
import { RegisterPage } from '../features/auth/RegisterPage'
import { VerifyPage } from '../features/auth/VerifyPage'
import { LandingPage } from '../features/landing/LandingPage'
import { AppLayout } from '../features/workspace/AppLayout'
import { ProtectedRoute } from './ProtectedRoute'

// Route-level code splitting: charts and heavy pages are not part of the landing bundle.
const lazyPage = <T extends Record<string, React.ComponentType>>(load: () => Promise<T>, name: keyof T) =>
  lazy(async () => ({ default: (await load())[name] }))

const Onboarding = lazyPage(() => import('../features/onboarding/OnboardingPage'), 'OnboardingPage')
const Dashboard = lazyPage(() => import('../features/dashboard/DashboardPage'), 'DashboardPage')
const AiAnalyst = lazyPage(() => import('../features/ai-analyst/AiAnalystPage'), 'AiAnalystPage')
const BiStudioPage = lazyPage(() => import('../features/bi/BiPage'), 'BiPage')
const FinancialReports = lazyPage(() => import('../features/financial-reports/FinancialReportsPage'), 'FinancialReportsPage')
const Integrations = lazyPage(() => import('../features/integrations/IntegrationsPage'), 'IntegrationsPage')
const DataInfra = lazyPage(() => import('../features/data-infrastructure/DataInfrastructurePage'), 'DataInfrastructurePage')
const Reports = lazyPage(() => import('../features/reports/ReportsPage'), 'ReportsPage')
const Subscription = lazyPage(() => import('../features/subscription/SubscriptionPage'), 'SubscriptionPage')
const Audit = lazyPage(() => import('../features/audit/AuditPage'), 'AuditPage')
const Settings = lazyPage(() => import('../features/settings/SettingsPage'), 'SettingsPage')

const page = (el: ReactNode) => <Suspense fallback={<LoadingState />}>{el}</Suspense>

function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <p className="eyebrow">404</p>
      <h1 className="text-2xl font-semibold">Страница не найдена</h1>
      <Link to="/" className="text-accent hover:underline">На главную</Link>
    </main>
  )
}

export const routes = [
  { path: '/', element: <LandingPage /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  { path: '/verify', element: <VerifyPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      { path: '/onboarding', element: page(<Onboarding />) },
      {
        path: '/app',
        element: <AppLayout />,
        children: [
          { index: true, element: page(<Dashboard />) },
          { path: 'ai-analyst', element: page(<AiAnalyst />) },
          { path: 'bi', element: page(<BiStudioPage />) },
          { path: 'financial-reports', element: page(<FinancialReports />) },
          { path: 'integrations', element: page(<Integrations />) },
          { path: 'integrations/1c', element: <Navigate to="/app/integrations" replace /> },
          { path: 'data-infrastructure', element: page(<DataInfra />) },
          { path: 'reports', element: page(<Reports />) },
          { path: 'subscription', element: page(<Subscription />) },
          { path: 'audit', element: page(<Audit />) },
          { path: 'settings', element: page(<Settings />) },
        ],
      },
    ],
  },
  { path: '*', element: <NotFound /> },
]

export const createRouter = () => createBrowserRouter(routes)
