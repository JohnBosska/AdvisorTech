import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Alert } from '../../components/feedback/Feedback'
import { Button } from '../../components/ui/Button'
import { Field } from '../../components/ui/Field'
import { authApi } from '../../lib/api/auth'
import { ApiError, describeApiError } from '../../lib/api/client'
import { useAuth } from '../../lib/auth/AuthProvider'
import { pendingVerification } from '../../lib/auth/pendingVerification'
import { AuthLayout } from './AuthLayout'
import { verifySchema, type VerifyValues } from './schemas'

const RESEND_SECONDS = 60

export function VerifyPage() {
  const { isAuthenticated, signIn } = useAuth()
  const navigate = useNavigate()
  const pending = pendingVerification.get()
  const [cooldown, setCooldown] = useState(pending ? RESEND_SECONDS : 0)
  const form = useForm<VerifyValues>({ resolver: zodResolver(verifySchema), defaultValues: { email: pending?.email ?? '', password: pending?.password ?? '', code: '' } })

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  const verify = useMutation({
    mutationFn: authApi.verify,
    onSuccess: (d) => { pendingVerification.clear(); signIn(d.access_token); navigate('/onboarding', { replace: true }) },
  })
  const resend = useMutation({
    mutationFn: authApi.resend,
    onSuccess: () => setCooldown(RESEND_SECONDS),
    onError: (e) => { if (e instanceof ApiError && e.status === 429 && e.retryAfter) setCooldown(e.retryAfter) },
  })
  if (isAuthenticated) return <Navigate to="/app" replace />

  const onResend = async () => {
    if (!(await form.trigger(['email', 'password']))) return
    const { email, password } = form.getValues()
    resend.mutate({ email, password })
  }

  return (
    <AuthLayout title="Подтвердите email" subtitle="Введите 8-значный код из письма. Он действует 10 минут, попыток — 5." footer={<Link to="/login" className="text-accent hover:underline">Вернуться ко входу</Link>}>
      <form className="flex flex-col gap-4" noValidate onSubmit={form.handleSubmit((v) => verify.mutate(v))}>
        <Field label="Email" type="email" autoComplete="email" error={form.formState.errors.email?.message} {...form.register('email')} />
        <Field label="Пароль" type="password" autoComplete="current-password" error={form.formState.errors.password?.message} {...form.register('password')} />
        <Field label="Код подтверждения" inputMode="numeric" autoComplete="one-time-code" maxLength={8} className="font-mono tracking-[0.3em] tabular" error={form.formState.errors.code?.message} {...form.register('code')} />
        {verify.isError && <Alert>{describeApiError(verify.error)}</Alert>}
        {resend.isSuccess && <Alert tone="success">Новый код отправлен.</Alert>}
        {resend.isError && <Alert>{describeApiError(resend.error)}</Alert>}
        <Button type="submit" disabled={verify.isPending}>{verify.isPending ? 'Проверяем…' : 'Подтвердить'}</Button>
        <Button type="button" variant="ghost" onClick={onResend} disabled={cooldown > 0 || resend.isPending}>
          {cooldown > 0 ? `Отправить код повторно (${cooldown} с)` : 'Отправить код повторно'}
        </Button>
      </form>
    </AuthLayout>
  )
}
