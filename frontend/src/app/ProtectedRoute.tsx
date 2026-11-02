import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { LoadingState } from '../components/feedback/Feedback'
import { useAuth } from '../lib/auth/AuthProvider'

export function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth()
  const location = useLocation()
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (isLoading) return <LoadingState label="Загружаем профиль…" />
  return <Outlet />
}
