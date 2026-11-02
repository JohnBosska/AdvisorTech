import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Alert } from '../../components/feedback/Feedback'
import { Button } from '../../components/ui/Button'
import { Field } from '../../components/ui/Field'
import { authApi } from '../../lib/api/auth'
import { describeApiError } from '../../lib/api/client'
import { useAuth } from '../../lib/auth/AuthProvider'
import { pendingVerification } from '../../lib/auth/pendingVerification'
import { AuthLayout } from './AuthLayout'
import { registerSchema, type RegisterValues } from './schemas'

export function RegisterPage() {
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const form = useForm<RegisterValues>({ resolver: zodResolver(registerSchema), defaultValues: { name: '', email: '', password: '' } })
  const register = useMutation({
    mutationFn: (v: RegisterValues) => authApi.register({ email: v.email, password: v.password, name: v.name || null }),
    onSuccess: (_, v) => { pendingVerification.set({ email: v.email, password: v.password }); navigate('/verify', { replace: true }) },
  })
  if (isAuthenticated) return <Navigate to="/app" replace />

  return (
    <AuthLayout title="Создать аккаунт" subtitle="Мы отправим 8-значный код подтверждения на email." footer={<>Уже есть аккаунт? <Link to="/login" className="text-accent hover:underline">Войти</Link></>}>
      <form className="flex flex-col gap-4" noValidate onSubmit={form.handleSubmit((v) => register.mutate(v))}>
        <Field label="Имя (необязательно)" autoComplete="name" error={form.formState.errors.name?.message} {...form.register('name')} />
        <Field label="Email" type="email" autoComplete="email" error={form.formState.errors.email?.message} {...form.register('email')} />
        <Field label="Пароль" type="password" autoComplete="new-password" hint="От 8 символов" error={form.formState.errors.password?.message} {...form.register('password')} />
        {register.isError && <Alert>{describeApiError(register.error)}</Alert>}
        <Button type="submit" disabled={register.isPending}>{register.isPending ? 'Отправляем код…' : 'Получить код'}</Button>
      </form>
    </AuthLayout>
  )
}
