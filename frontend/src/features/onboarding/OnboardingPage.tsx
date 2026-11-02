import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, Circle, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { Alert, DemoBadge, LoadingState } from '../../components/feedback/Feedback'
import { Wordmark } from '../../components/navigation/Wordmark'
import { Button } from '../../components/ui/Button'
import { Field } from '../../components/ui/Field'
import { describeApiError } from '../../lib/api/client'
import { useActiveOrganization } from '../../lib/api/hooks'
import { organizationsApi } from '../../lib/api/organizations'
import { ConnectionForm } from '../integrations/ConnectionForm'

type Kind = 'real' | 'demo'
const STEPS: { id: string; title: string; kind: Kind }[] = [
  { id: 'company', title: 'Профиль компании', kind: 'real' },
  { id: 'source', title: 'Источник данных', kind: 'real' },
  { id: 'connect', title: 'Подключение 1С', kind: 'real' },
  { id: 'agent', title: 'Connector Agent', kind: 'demo' },
  { id: 'test', title: 'Проверка подключения', kind: 'demo' },
  { id: 'provision', title: 'Аналитическая PostgreSQL', kind: 'demo' },
  { id: 'sync', title: 'Первичная синхронизация', kind: 'demo' },
  { id: 'validate', title: 'Проверка данных', kind: 'demo' },
]

const companySchema = z.object({
  name: z.string().trim().min(1, 'Введите название').max(120),
  legal_name: z.string().trim().max(255),
  tax_id: z.string().trim().regex(/^([0-9]{10}|[0-9]{12})?$/, 'ИНН: 10 или 12 цифр'),
})

function SimulatedStep({ title, lines }: { title: string; lines: string[] }) {
  const [done, setDone] = useState(0)
  const [running, setRunning] = useState(false)
  useEffect(() => {
    if (!running || done >= lines.length) return
    const t = setTimeout(() => setDone((d) => d + 1), 800)
    return () => clearTimeout(t)
  }, [running, done, lines.length])
  return (
    <div className="space-y-4">
      <Alert tone="info">Демонстрация шага «{title}». Реальной операции не выполняется: Connector Agent, развёртывание PostgreSQL и синхронизация ещё не реализованы.</Alert>
      <ul className="space-y-2">
        {lines.map((l, i) => (
          <li key={l} className="flex items-center gap-2 text-sm">
            {i < done ? <Check className="h-4 w-4 text-accent" aria-hidden /> : running && i === done ? <Loader2 className="h-4 w-4 animate-spin text-cyan" aria-hidden /> : <Circle className="h-4 w-4 text-border-strong" aria-hidden />}
            <span className={i < done ? '' : 'text-muted'}>{l}</span>
          </li>
        ))}
      </ul>
      {done < lines.length && <Button variant="secondary" size="sm" disabled={running} onClick={() => setRunning(true)}>{running ? 'Выполняется (демо)…' : 'Запустить (демо)'}</Button>}
      {done >= lines.length && <p role="status" className="text-sm text-accent">Демо-шаг завершён.</p>}
    </div>
  )
}

const DEMO_LINES: Record<string, string[]> = {
  agent: ['Скачать установщик Connector Agent', 'Зарегистрировать агент по одноразовому коду', 'Агент устанавливает исходящее зашифрованное соединение'],
  test: ['Доступность опубликованного интерфейса 1С', 'Определение конфигурации и версии', 'Определение доступных сущностей'],
  provision: ['Создание логически отдельной базы PostgreSQL', 'Применение миграций (Raw, Staging, Core, Marts)', 'Настройка резервного копирования'],
  sync: ['Загрузка справочников и номенклатуры', 'Загрузка продаж, закупок и остатков', 'Загрузка проводок и оборотов'],
  validate: ['Сверка итогов с источником', 'Проверка полноты сопоставления счетов', 'Расчёт статусов качества данных'],
}

export function OnboardingPage() {
  const nav = useNavigate()
  const qc = useQueryClient()
  const { organization, isPending } = useActiveOrganization()
  const [step, setStep] = useState(0)
  const [usesOnec, setUsesOnec] = useState<boolean | null>(null)
  const form = useForm<z.infer<typeof companySchema>>({ resolver: zodResolver(companySchema), defaultValues: { name: '', legal_name: '', tax_id: '' } })

  const create = useMutation({
    mutationFn: (v: z.infer<typeof companySchema>) => organizationsApi.create({ name: v.name, legal_name: v.legal_name || null, tax_id: v.tax_id || null, uses_onec: usesOnec }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['organizations'] }); setStep(1) },
  })

  if (isPending) return <LoadingState />
  const cur = STEPS[step]
  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1))
  const last = step === STEPS.length - 1

  return (
    <div className="mx-auto min-h-screen max-w-5xl px-4 py-8 sm:px-6">
      <header className="flex items-center justify-between"><Wordmark to="/app" /><button type="button" onClick={() => nav('/app')} className="text-sm text-muted hover:text-white">Пропустить</button></header>
      <div className="mt-10 grid gap-8 md:grid-cols-[240px_1fr]">
        <nav aria-label="Шаги подключения">
          <ol className="space-y-1">
            {STEPS.map((s, i) => (
              <li key={s.id}>
                <button type="button" disabled={i > step} onClick={() => setStep(i)} aria-current={i === step ? 'step' : undefined} className={`flex w-full items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 text-left text-sm transition-colors ${i === step ? 'bg-surface-3 text-white' : 'text-muted'} ${i > step ? 'opacity-50' : 'hover:text-white'}`}>
                  <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[10px] ${i < step ? 'border-accent bg-accent text-black' : i === step ? 'border-accent text-accent' : 'border-border-strong'}`}>{i < step ? <Check className="h-3 w-3" aria-hidden /> : i + 1}</span>
                  <span className="flex-1">{s.title}</span>{s.kind === 'demo' && <span className="font-mono text-[9px] uppercase text-violet">демо</span>}
                </button>
              </li>
            ))}
          </ol>
        </nav>

        <main className="rise rounded-[var(--radius-lg)] border border-border bg-surface-1 p-6 sm:p-8" key={cur.id}>
          <div className="flex items-center justify-between gap-3"><p className="eyebrow">Шаг {step + 1} из {STEPS.length}</p>{cur.kind === 'demo' && <DemoBadge />}</div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">{cur.title}</h1>
          <div className="mt-6">
            {cur.id === 'company' && (organization ? (
              <div className="space-y-4"><Alert tone="success">Рабочее пространство «{organization.name}» уже создано.</Alert><Button onClick={next}>Далее</Button></div>
            ) : (
              <form className="space-y-4" noValidate onSubmit={form.handleSubmit((v) => create.mutate(v))}>
                <Field label="Название компании" error={form.formState.errors.name?.message} {...form.register('name')} />
                <Field label="Юридическое название" {...form.register('legal_name')} />
                <Field label="ИНН" inputMode="numeric" hint="10 цифр для юрлица, 12 для ИП. Необязательно." error={form.formState.errors.tax_id?.message} {...form.register('tax_id')} />
                <fieldset><legend className="mb-2 text-[13px] text-text-soft">Используете ли вы 1С?</legend>
                  <div className="flex gap-3">{[{ v: true, l: 'Да' }, { v: false, l: 'Нет' }].map((o) => <label key={o.l} className={`cursor-pointer rounded-[var(--radius-md)] border px-4 py-2 text-sm ${usesOnec === o.v ? 'border-accent text-accent' : 'border-border text-muted'}`}><input type="radio" name="onec" className="sr-only" checked={usesOnec === o.v} onChange={() => setUsesOnec(o.v)} />{o.l}</label>)}</div>
                </fieldset>
                {create.isError && <Alert>{describeApiError(create.error)}</Alert>}
                <Button type="submit" disabled={create.isPending}>{create.isPending ? 'Создаём…' : 'Создать рабочее пространство'}</Button>
              </form>
            ))}
            {cur.id === 'source' && (
              <div className="space-y-4">
                <p className="text-sm text-muted">Платформа подключается к клиент-серверной 1С на PostgreSQL или Microsoft SQL Server через опубликованные интерфейсы 1С. Прямые запросы к таблицам 1С не используются, запись в 1С не выполняется.</p>
                <ul className="list-disc space-y-1 pl-5 text-sm text-text-soft"><li>1С:Бухгалтерия, 1С:Управление торговлей, 1С:ERP — кандидаты первого релиза</li><li>Другие и доработанные конфигурации — после проверки совместимости</li></ul>
                <Button onClick={next}>Далее</Button>
              </div>
            )}
            {cur.id === 'connect' && (organization ? (
              <div className="space-y-4">
                <ConnectionForm organizationId={organization.id} onDone={next} />
                <Button variant="ghost" onClick={next}>Пропустить этот шаг</Button>
              </div>
            ) : <Alert tone="warning">Сначала создайте рабочее пространство на первом шаге.</Alert>)}
            {DEMO_LINES[cur.id] && <SimulatedStep title={cur.title} lines={DEMO_LINES[cur.id]} />}
          </div>
          {DEMO_LINES[cur.id] && (
            <div className="mt-8 flex justify-between border-t border-border pt-5">
              <Button variant="ghost" onClick={() => setStep((s) => s - 1)}>Назад</Button>
              {last ? <Button onClick={() => nav('/app')}>Открыть рабочее пространство</Button> : <Button variant="secondary" onClick={next}>Далее</Button>}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
