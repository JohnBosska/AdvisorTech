import { zodResolver } from '@hookform/resolvers/zod'
import { Check } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Alert, ErrorState, LoadingState } from '../../components/feedback/Feedback'
import { PageHeader } from '../../components/feedback/PageHeader'
import { Button } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/Dialog'
import { Field } from '../../components/ui/Field'
import { Badge, type Tone } from '../../components/ui/StatusBadge'
import { describeApiError } from '../../lib/api/client'
import { useActiveOrganization } from '../../lib/api/hooks'
import type { SubscriptionStatus } from '../../lib/api/organizations'

const STATUS: Record<SubscriptionStatus, { label: string; tone: Tone }> = {
  PENDING: { label: 'Не активирована', tone: 'neutral' }, ACTIVE: { label: 'Активна', tone: 'success' },
  SUSPENDED: { label: 'Приостановлена', tone: 'warning' }, CANCELLED: { label: 'Отменена', tone: 'danger' },
}
const FEATURES = ['Интеграция с поддерживаемыми конфигурациями 1С', 'Автоматическая синхронизация данных', 'Облачная аналитическая PostgreSQL', 'Сквозная аналитика: товары, запасы, склады, логистика', 'Финансовая отчётность для собственника, ориентированная на РСБУ', 'AI-аналитик с RAG-контекстом', 'Excel-отчёты с расчётами и рекомендациями']
const OPEN = ['Стоимость и периодичность оплаты', 'Пробный период или пилот', 'Количество юрлиц и подключений 1С', 'Лимиты данных, истории, AI-запросов и отчётов', 'Частота синхронизации и уровень поддержки']

const schema = z.object({ contact: z.string().trim().min(1, 'Укажите контакт'), comment: z.string().max(500) })

export function SubscriptionPage() {
  const { organization, isPending, error, refetch } = useActiveOrganization()
  const [open, setOpen] = useState(false)
  const [sent, setSent] = useState(false)
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { contact: '', comment: '' } })

  if (isPending) return <LoadingState />
  if (error) return <ErrorState message={describeApiError(error)} onRetry={() => void refetch()} />
  const sub = organization?.subscription
  const st = sub ? STATUS[sub.status] : STATUS.PENDING

  return (
    <div className="space-y-6">
      <PageHeader demo={false} title="Подписка" description="Премиальная подписка объединяет интеграцию, аналитику и AI в одном тарифе." />
      <section className="rounded-[var(--radius-lg)] border border-border bg-surface-1 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div><p className="eyebrow">Тариф</p><h2 className="mt-2 text-2xl font-semibold">Premium</h2></div>
          <div className="flex items-center gap-3"><span className="text-sm text-muted">Статус:</span><Badge tone={st.tone}>{st.label}</Badge></div>
        </div>
        <ul className="mt-6 grid gap-2 sm:grid-cols-2">{FEATURES.map((f) => <li key={f} className="flex items-start gap-2 text-sm"><Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />{f}</li>)}</ul>
        <div className="mt-6 flex flex-wrap gap-3"><Button onClick={() => { setSent(false); setOpen(true) }}>Запросить подключение</Button></div>
      </section>
      <section className="rounded-[var(--radius-lg)] border border-border p-6">
        <h2 className="text-[15px] font-medium">Условия ещё не определены</h2>
        <p className="mt-1 text-sm text-muted">Мы не показываем цены, пробный период или лимиты, пока они не утверждены. Биллинг и приём платежей не подключены.</p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted">{OPEN.map((o) => <li key={o}>{o}</li>)}</ul>
      </section>
      <Dialog open={open} onClose={() => setOpen(false)} title="Запрос на подключение" description="Демо-форма: заявка не отправляется на сервер.">
        {sent ? <Alert tone="success">Заявка сохранена только на этом экране (демо). Когда подписки заработают, она уйдёт в команду продукта.</Alert> : (
          <form className="space-y-4" noValidate onSubmit={form.handleSubmit(() => setSent(true))}>
            <Field label="Email или телефон для связи" error={form.formState.errors.contact?.message} {...form.register('contact')} />
            <Field label="Комментарий (необязательно)" {...form.register('comment')} />
            <Button type="submit">Отправить (демо)</Button>
          </form>
        )}
      </Dialog>
    </div>
  )
}
