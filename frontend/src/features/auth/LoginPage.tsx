import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Alert } from '../../components/feedback/Feedback'
import { Button } from '../../components/ui/Button'
import { Field } from '../../components/ui/Field'
import { authApi } from '../../lib/api/auth'
import { ApiError, describeApiError } from '../../lib/api/client'
import { useAuth } from '../../lib/auth/AuthProvider'
import { pendingVerification } from '../../lib/auth/pendingVerification'
import { AuthLayout } from './AuthLayout'
import { loginSchema, type LoginValues } from './schemas'

export function LoginPage() {
  const { isAuthenticated, signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/app'
  const form = useForm<LoginValues>({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } })

  const login = useMutation({
    mutationFn: authApi.login,
    onSuccess: (data) => { signIn(data.access_token); navigate(from, { replace: true }) },
    onError: (error, vars) => {
      if (error instanceof ApiError && error.status === 403) { pendingVerification.set(vars); navigate('/verify', { replace: true }) }
    },
  })
  if (isAuthenticated) return <Navigate to="/app" replace />

  return (
    <AuthLayout title="Вход" subtitle="Войдите, чтобы открыть рабочее пространство." footer={<>Нет аккаунта? <Link to="/register" className="text-accent-ink hover:underline">Зарегистрироваться</Link></>}>
      <form className="flex flex-col gap-4" noValidate onSubmit={form.handleSubmit((v) => login.mutate(v))}>
        <Field label="Email" type="email" autoComplete="email" error={form.formState.errors.email?.message} {...form.register('email')} />
        <Field label="Пароль" type="password" autoComplete="current-password" error={form.formState.errors.password?.message} {...form.register('password')} />
        {login.isError && !(login.error instanceof ApiError && login.error.status === 403) && <Alert>{describeApiError(login.error)}</Alert>}
        <Button type="submit" disabled={login.isPending}>{login.isPending ? 'Входим…' : 'Войти'}</Button>
      </form>
    </AuthLayout>
  )
}
