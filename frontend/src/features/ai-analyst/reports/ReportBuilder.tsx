import { ArrowUp, Download, FileUp, LayoutGrid, Plus, Sparkles, Table2, X } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ApiError } from '../../../lib/api/client'
import { reportsApi, type Aggregation, type Dataset, type Widget, type WidgetType } from '../../../lib/api/reports'
import { toCsv, widgetError } from './aggregate'
import { WidgetCard, widgetPoints } from './WidgetCard'

const IDEAS = ['Динамика выручки по месяцам', 'Топ-10 товарных групп по сумме', 'Структура продаж по складам', 'Ключевые показатели: итог, среднее, количество']
const TYPES: { id: WidgetType; label: string }[] = [
  { id: 'kpi', label: 'KPI' }, { id: 'bar', label: 'Столбцы' }, { id: 'line', label: 'Линия' }, { id: 'pie', label: 'Кольцо' }, { id: 'table', label: 'Таблица' },
]
const AGGS: { id: Aggregation; label: string }[] = [
  { id: 'sum', label: 'Сумма' }, { id: 'avg', label: 'Среднее' }, { id: 'count', label: 'Количество' }, { id: 'min', label: 'Минимум' }, { id: 'max', label: 'Максимум' },
]

/** 4xx/503 details from this API are Russian user-facing text; anything else gets a generic message. */
function explain(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 0) return 'Нет связи с сервером.'
    if (e.status === 429) return 'Слишком много запросов к ИИ: подождите минуту.'
    if ((e.status === 400 || e.status === 503) && /[а-яё]/i.test(e.message)) return e.message
    if (e.status === 503) return 'ИИ-модель на сервере не подключена или недоступна.'
    if (e.status === 413) return 'Файл слишком большой (максимум 5 МБ).'
  }
  return 'Не получилось. Попробуйте ещё раз.'
}

const field = 'h-9 w-full rounded-xl border border-white/10 bg-white/[0.04] px-2.5 text-[13px] text-white outline-none transition focus:border-[#00e599]/60'

function ManualWidget({ data, onAdd }: { data: Dataset; onAdd: (w: Widget) => void }) {
  const numbers = data.columns.filter((c) => c.type === 'number')
  const [w, setW] = useState<Widget>({ type: 'bar', title: '', x: data.columns.find((c) => c.type !== 'number')?.name ?? null, y: numbers[0]?.name ?? null, agg: numbers.length ? 'sum' : 'count', limit: 12 })
  const draft: Widget = { ...w, x: w.type === 'kpi' ? null : w.x, y: w.agg === 'count' ? null : w.y, title: w.title.trim() || (w.agg === 'count' ? 'Количество строк' : `${w.y ?? ''}`) }
  const error = widgetError(draft, data.columns)
  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Тип виджета">
        {TYPES.map((t) => <button key={t.id} type="button" role="radio" aria-checked={w.type === t.id} onClick={() => setW({ ...w, type: t.id })} className={`glass-chip ${w.type === t.id ? 'on' : ''}`}>{t.label}</button>)}
      </div>
      <input aria-label="Название виджета" placeholder="Название (необязательно)" value={w.title} maxLength={120} onChange={(e) => setW({ ...w, title: e.target.value })} className={field} />
      {w.type !== 'kpi' && (
        <select aria-label="Группировать по" value={w.x ?? ''} onChange={(e) => setW({ ...w, x: e.target.value })} className={field}>
          {data.columns.map((c) => <option key={c.name} value={c.name}>По: {c.name}</option>)}
        </select>
      )}
      <div className="grid grid-cols-2 gap-2">
        <select aria-label="Агрегация" value={w.agg} onChange={(e) => setW({ ...w, agg: e.target.value as Aggregation })} className={field}>
          {AGGS.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
        </select>
        <select aria-label="Мера" value={w.y ?? ''} disabled={w.agg === 'count'} onChange={(e) => setW({ ...w, y: e.target.value })} className={`${field} disabled:opacity-40`}>
          {numbers.length === 0 && <option value="">Нет числовых колонок</option>}
          {numbers.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
        </select>
      </div>
      {error && <p className="text-[12px] text-[#e6b85c]">{error}</p>}
      <button type="button" disabled={!!error} onClick={() => onAdd(draft)} className="glass-btn w-full justify-center disabled:opacity-40"><Plus className="h-3.5 w-3.5" aria-hidden />Добавить виджет</button>
    </div>
  )
}

export function ReportBuilder({ orgId, aiReady, onClose }: { orgId: number; aiReady: boolean; onClose: () => void }) {
  const [data, setData] = useState<Dataset | null>(null)
  const [title, setTitle] = useState('Новый отчёт')
  const [widgets, setWidgets] = useState<Widget[]>([])
  const [prompt, setPrompt] = useState('')
  const [busy, setBusy] = useState<'upload' | 'plan' | null>(null)
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  const [panel, setPanel] = useState<'ai' | 'manual'>('ai')
  const fileRef = useRef<HTMLInputElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [onClose])

  const upload = async (file: File | undefined) => {
    if (!file) return
    setBusy('upload'); setError(''); setNote('')
    try {
      const d = await reportsApi.upload(orgId, file)
      setData(d); setWidgets([]); setTitle(file.name.replace(/\.[^.]+$/, ''))
      if (d.truncated) setNote(`В отчёт взяты первые ${d.rows.length.toLocaleString('ru-RU')} строк из ${d.total_rows.toLocaleString('ru-RU')}.`)
    } catch (e) { setError(explain(e)) } finally { setBusy(null) }
  }

  const plan = async (e?: FormEvent, text = prompt) => {
    e?.preventDefault()
    if (!data || !text.trim()) return
    setBusy('plan'); setError(''); setNote('')
    try {
      const p = await reportsApi.plan(orgId, text.trim(), data.columns)
      setTitle(p.title); setWidgets(p.widgets); setPrompt('')
      setNote(`План составил ${p.model}. Числа посчитаны в браузере по вашей таблице.${p.dropped ? ` Отброшено некорректных виджетов: ${p.dropped}.` : ''}`)
    } catch (err) { setError(explain(err)) } finally { setBusy(null) }
  }

  const exportCsv = () => {
    if (!data) return
    const csv = toCsv(widgets.map((w) => ({ title: w.title, points: widgetPoints(data.rows, w, data.columns) })))
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a'); a.href = url; a.download = `${title || 'report'}.csv`; a.click(); URL.revokeObjectURL(url)
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="BI-конструктор отчётов" className="glass-stage fixed inset-0 z-50 flex flex-col overflow-hidden">
      <header className="relative z-10 flex items-center gap-3 border-b border-white/[0.08] px-4 py-3 sm:px-6">
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#00e599]/15 text-[#00e599]"><LayoutGrid className="h-4 w-4" aria-hidden /></span>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/45">BI-конструктор · отчёт через ИИ</p>
          <input aria-label="Название отчёта" value={title} maxLength={160} onChange={(e) => setTitle(e.target.value)} className="w-full truncate bg-transparent text-[16px] font-medium text-white outline-none" />
        </div>
        {widgets.length > 0 && <button type="button" onClick={exportCsv} className="glass-btn hidden sm:inline-flex"><Download className="h-3.5 w-3.5" aria-hidden />CSV</button>}
        <button ref={closeRef} type="button" onClick={onClose} aria-label="Закрыть конструктор" className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-white/70 transition hover:bg-white/10 hover:text-white"><X className="h-4 w-4" /></button>
      </header>

      <div className="relative z-10 grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[340px_minmax(0,1fr)] lg:overflow-hidden">
        <aside className="space-y-4 p-4 sm:p-6 lg:overflow-y-auto lg:pr-3">
          <section className="glass p-4">
            <p className="flex items-center gap-2 text-[13px] font-medium text-white"><Table2 className="h-4 w-4 text-[#00e599]" aria-hidden />Данные</p>
            <input ref={fileRef} type="file" accept=".csv,.xlsx,.txt" className="sr-only" aria-label="Файл с данными" onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = '' }} />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); void upload(e.dataTransfer.files[0]) }}
              className="mt-3 flex w-full flex-col items-center gap-1.5 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-3 py-5 text-center transition hover:border-[#00e599]/50 hover:bg-[#00e599]/[0.04]"
            >
              <FileUp className="h-5 w-5 text-white/60" aria-hidden />
              <span className="text-[13px] text-white">{busy === 'upload' ? 'Читаю файл…' : data ? data.filename : 'Загрузите CSV или XLSX'}</span>
              <span className="text-[11px] text-white/40">{data ? `${data.total_rows.toLocaleString('ru-RU')} строк · ${data.columns.length} колонок` : 'Выгрузка из 1С, до 5 МБ, первая строка — заголовки'}</span>
            </button>
            {data && (
              <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Колонки">
                {data.columns.map((c) => <li key={c.name} className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 font-mono text-[10.5px] text-white/65" title={c.samples.join(', ')}><span className={c.type === 'number' ? 'text-[#00e599]' : c.type === 'date' ? 'text-[#5b8def]' : 'text-white/40'}>{c.type === 'number' ? '#' : c.type === 'date' ? '◷' : 'Aa'}</span> {c.name}</li>)}
              </ul>
            )}
          </section>

          <section className="glass p-4">
            <div className="flex rounded-xl bg-black/30 p-1 text-[12px]" role="tablist">
              <button type="button" role="tab" aria-selected={panel === 'ai'} onClick={() => setPanel('ai')} className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 transition ${panel === 'ai' ? 'bg-white/10 text-white' : 'text-white/50'}`}><Sparkles className="h-3.5 w-3.5" aria-hidden />Через ИИ</button>
              <button type="button" role="tab" aria-selected={panel === 'manual'} onClick={() => setPanel('manual')} className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 transition ${panel === 'manual' ? 'bg-white/10 text-white' : 'text-white/50'}`}><Plus className="h-3.5 w-3.5" aria-hidden />Вручную</button>
            </div>
            <div className="mt-3">
              {!data && <p className="text-[12px] text-white/45">Сначала загрузите таблицу.</p>}
              {data && panel === 'ai' && (
                <form onSubmit={(e) => void plan(e)} className="space-y-2.5">
                  {!aiReady && <p className="text-[12px] text-[#e6b85c]">ИИ-модель на сервере не подключена — соберите отчёт вручную.</p>}
                  <div className="glass-input flex items-end gap-2 p-1.5">
                    <label htmlFor="bi-q" className="sr-only">Опишите отчёт</label>
                    <textarea id="bi-q" rows={3} value={prompt} maxLength={1000} onChange={(e) => setPrompt(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void plan() } }} placeholder="Например: выручка по месяцам и топ групп товаров" className="min-h-[64px] flex-1 resize-none bg-transparent px-2 py-1.5 text-[13px] text-white outline-none placeholder:text-white/35" />
                    <button type="submit" disabled={!prompt.trim() || busy !== null || !aiReady} aria-label="Собрать отчёт" className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#00e599] text-black transition hover:brightness-110 disabled:opacity-35"><ArrowUp className="h-4 w-4" aria-hidden /></button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {IDEAS.map((q) => <button key={q} type="button" disabled={busy !== null || !aiReady} onClick={() => void plan(undefined, q)} className="glass-chip disabled:opacity-40">{q}</button>)}
                  </div>
                  <p className="text-[11px] leading-relaxed text-white/35">ИИ видит только названия колонок и по три примера значений. Строки таблицы не отправляются, а все числа считаются в браузере.</p>
                </form>
              )}
              {data && panel === 'manual' && <ManualWidget data={data} onAdd={(w) => setWidgets((ws) => [...ws, w].slice(-12))} />}
            </div>
          </section>
          {error && <p role="alert" className="glass border-[#e0645f]/40 px-4 py-3 text-[13px] text-[#f3a29f]">{error}</p>}
          {note && <p role="status" className="px-1 text-[12px] text-white/50">{note}</p>}
        </aside>

        <main className="min-h-[320px] p-4 sm:p-6 lg:overflow-y-auto lg:pl-3" aria-busy={busy === 'plan'}>
          {busy === 'plan' && <div className="mb-4 flex items-center gap-2 text-[13px] text-white/70"><span className="glass-spinner" aria-hidden />ИИ проектирует отчёт…</div>}
          {widgets.length === 0 && busy !== 'plan' ? (
            <div className="glass flex h-full min-h-[320px] flex-col items-center justify-center gap-3 p-8 text-center">
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[#00e599]/10 text-[#00e599] shadow-[0_0_40px_-8px_rgb(0_229_153/0.6)]"><Sparkles className="h-6 w-6" aria-hidden /></span>
              <p className="text-[18px] font-medium text-white">Опишите отчёт словами</p>
              <p className="max-w-[420px] text-[13px] leading-relaxed text-white/50">Загрузите таблицу, напишите, что хотите увидеть, и ИИ соберёт дашборд: KPI, графики и таблицы. Виджеты можно удалять и добавлять вручную.</p>
            </div>
          ) : data && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {widgets.map((w, i) => <WidgetCard key={`${i}-${w.title}`} w={w} rows={data.rows} columns={data.columns} onRemove={() => setWidgets((ws) => ws.filter((_, j) => j !== i))} />)}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
