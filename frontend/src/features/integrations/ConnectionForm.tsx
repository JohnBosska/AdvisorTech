import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Alert } from '../../components/feedback/Feedback'
import { Button } from '../../components/ui/Button'
import { Field, SelectField } from '../../components/ui/Field'
import { describeApiError } from '../../lib/api/client'
import { organizationsApi, type SourceConnection } from '../../lib/api/organizations'

export const CONFIG_LABEL: Record<SourceConnection['configuration'], string> = { ACCOUNTING: '1С:Бухгалтерия', TRADE_MANAGEMENT: '1С:Управление торговлей', ERP: '1С:ERP', OTHER: 'Другая конфигурация (требует проверки)' }
export const TRANSPORT_LABEL: Record<SourceConnection['transport'], string> = { ODATA: 'OData', HTTP_SERVICE: 'HTTP-сервисы 1С', EXTENSION: 'Расширение 1С', FILE_EXCHANGE: 'Файловый обмен' }
export const DBMS_LABEL: Record<SourceConnection['source_dbms'], string> = { POSTGRESQL: 'PostgreSQL', MSSQL: 'Microsoft SQL Server' }

const schema = z.object({
  name: z.string().trim().min(1, 'Введите название').max(120),
  configuration: z.enum(['ACCOUNTING', 'TRADE_MANAGEMENT', 'ERP', 'OTHER']),
  configuration_version: z.string().trim().max(32),
  source_dbms: z.enum(['POSTGRESQL', 'MSSQL']),
  transport: z.enum(['ODATA', 'HTTP_SERVICE', 'EXTENSION', 'FILE_EXCHANGE']),
})
type Values = z.infer<typeof schema>

/** Creates a real DRAFT connection record via the API. It does not contact 1C. */
export function ConnectionForm({ organizationId, onDone }: { organizationId: number; onDone: (c: SourceConnection) => void }) {
  const qc = useQueryClient()
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { name: '', configuration: 'TRADE_MANAGEMENT', configuration_version: '', source_dbms: 'POSTGRESQL', transport: 'ODATA' } })
  const create = useMutation({
    mutationFn: (v: Values) => organizationsApi.createConnection(organizationId, { ...v, configuration_version: v.configuration_version || null }),
    onSuccess: (c) => { void qc.invalidateQueries({ queryKey: ['connections', organizationId] }); onDone(c) },
  })
  const e = form.formState.errors
  return (
    <form className="space-y-4" noValidate onSubmit={form.handleSubmit((v) => create.mutate(v))}>
      <Field label="Название подключения" placeholder="Например, 1С Торговля — Москва" error={e.name?.message} {...form.register('name')} />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField label="Конфигурация 1С" {...form.register('configuration')}>{Object.entries(CONFIG_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</SelectField>
        <Field label="Версия конфигурации" placeholder="например, 11.5.18" error={e.configuration_version?.message} {...form.register('configuration_version')} />
        <SelectField label="СУБД информационной базы" {...form.register('source_dbms')}>{Object.entries(DBMS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</SelectField>
        <SelectField label="Способ подключения" hint="Прямые SQL-запросы к таблицам 1С не используются." {...form.register('transport')}>{Object.entries(TRANSPORT_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</SelectField>
      </div>
      <p className="text-xs text-muted">Подключение создаётся как <b>черновик</b> и работает только на чтение. Connector Agent и обмен данными ещё не реализованы — данные из 1С не загружаются.</p>
      {create.isError && <Alert>{describeApiError(create.error)}</Alert>}
      <Button type="submit" disabled={create.isPending}>{create.isPending ? 'Создаём…' : 'Создать подключение'}</Button>
    </form>
  )
}
