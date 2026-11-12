import { ArrowUp, ChevronLeft, ChevronRight, Database, Download, Eye, FileUp, FolderOpen, LayoutGrid, Pencil, Plus, Printer, Redo2, RefreshCw, Save, Sparkles, Undo2, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { ApiError } from '../../lib/api/client'
import { biApi, type SavedSource } from '../../lib/api/bi'
import { reportsApi, type Dataset, type Widget } from '../../lib/api/reports'
import { toCsv } from '../ai-analyst/reports/aggregate'
import { SourcePanel } from '../ai-analyst/reports/SourcePanel'
import { UrlPanel } from '../ai-analyst/reports/UrlPanel'
import { WarehousePanel } from './WarehousePanel'
import { Canvas } from './Canvas'
import { applyFilters, cardValue, categorySeries, columnTypes, pivot, tableRows, visualFilters } from './compute'
import { FieldsPane } from './FieldsPane'
import { FiltersPane } from './FiltersPane'
import { FormatPane } from './FormatPane'
import { ReportsDialog } from './ReportsDialog'
import { THEMES } from './theme'
import { emptySpec, findSpot, newPage, newVisual, uid, VISUALS, type CrossFilter, type Fields, type Format, type ReportSpec, type ThemeId, type Visual, type VisualType } from './types'
import { useHistory } from './useHistory'

const IDEAS = ['Динамика выручки по месяцам', 'Топ-10 товарных групп', 'Структура продаж по складам', 'Ключевые показатели']

/** 4xx/503 details from this API are Russian user-facing text; anything else gets a generic message. */
export function explain(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 0) return 'Нет связи с сервером.'
    if (e.status === 429) return 'Слишком много запросов: подождите минуту.'
    if (e.status === 403 && /[а-яё]/i.test(e.message)) return e.message
    if ((e.status === 400 || e.status === 404 || e.status === 503) && /[а-яё]/i.test(e.message)) return e.message
    if (e.status === 503) return 'ИИ-модель на сервере не подключена или недоступна.'
    if (e.status === 413) return 'Слишком большой объём данных.'
  }
  return 'Не получилось. Попробуйте ещё раз.'
}

/** Turns an AI plan (server-validated widgets) into visuals placed on a page. */
export function planToVisuals(widgets: Widget[], page: ReportSpec['pages'][number]): Visual[] {
  const placed = { ...page, visuals: [...page.visuals] }
  const ordered = [...widgets.filter((w) => w.type === 'kpi'), ...widgets.filter((w) => w.type !== 'kpi')]
  for (const w of ordered) {
    const type: VisualType = w.type === 'kpi' ? 'card' : w.type
    const fields: Partial<Fields> = w.type === 'table' ? { columns: [w.x, w.y].filter((c): c is string => !!c), agg: w.agg } : { category: w.x, value: w.y, agg: w.agg }
    const def = VISUALS.find((v) => v.type === type)!
    const v = newVisual(type, findSpot(placed, def.w, def.h), fields, w.title)
    if (type !== 'card' && w.limit && w.limit < 50) v.format.topN = type === 'line' ? 0 : w.limit
    placed.visuals.push(v)
  }
  return placed.visuals
}

function visualCsv(v: Visual, data: Dataset, rows: Dataset['rows'], types: Record<string, string>): string {
  const title = v.format.title || 'Визуал'
  if (v.type === 'card') return toCsv([{ title, points: [{ label: v.fields.value ?? 'Количество', value: cardValue(rows, v.fields) }] }])
  if (v.type === 'table') { const t = tableRows(rows, v.fields, v.format, types); return [t.headers.join(';'), ...t.rows.map((r) => t.headers.map((h) => String(r[h]).replace('.', ',')).join(';'))].join('\n') }
  if (v.type === 'matrix') { const p = pivot(rows, v.fields, types); return [[v.fields.category, ...p.cols].join(';'), ...p.rows.map((r) => [r, ...p.cols.map((c) => String(p.cells[r][c]).replace('.', ','))].join(';'))].join('\n') }
  const sd = categorySeries(rows, v.fields, v.format, types)
  void data
  return [['Категория', ...sd.series].join(';'), ...sd.data.map((d) => [d.category, ...sd.series.map((s) => String(d[s]).replace('.', ','))].join(';'))].join('\n')
}

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url)
}

export function BiStudio({ orgId, aiReady, mode = 'overlay', onClose }: { orgId: number; aiReady: boolean; mode?: 'overlay' | 'page'; onClose?: () => void }) {
  const history = useHistory<ReportSpec>(emptySpec())
  const spec = history.state
  const setSpec = history.set
  const [pageId, setPageId] = useState(spec.pages[0].id)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [data, setData] = useState<Dataset | null>(null)
  const [source, setSource] = useState<SavedSource>({ kind: 'none', label: '' })
  const [reportId, setReportId] = useState<number | null>(null)
  const [title, setTitle] = useState('Новый отчёт')
  const [dirty, setDirty] = useState(false)
  const [editing, setEditing] = useState(true)
  const [rightTab, setRightTab] = useState<'fields' | 'format' | 'filters'>('fields')
  const [leftOpen, setLeftOpen] = useState(true)
  const [sourceKind, setSourceKind] = useState<'warehouse' | 'file' | 'url' | 'onec' | 'postgres'>('warehouse')
  const [cross, setCross] = useState<CrossFilter | null>(null)
  const [prompt, setPrompt] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  const [openList, setOpenList] = useState(false)
  const [renaming, setRenaming] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const theme = THEMES[spec.theme]
  const page = spec.pages.find((p) => p.id === pageId) ?? spec.pages[0]
  const selected = page.visuals.find((v) => v.id === selectedId) ?? null
  const types = useMemo(() => (data ? columnTypes(data) : {}), [data])
  const fail = useCallback((e: unknown) => setError(explain(e)), [])

  const change = useCallback((fn: (s: ReportSpec) => ReportSpec) => { setSpec(fn); setDirty(true) }, [setSpec])
  const changePage = (fn: (p: ReportSpec['pages'][number]) => ReportSpec['pages'][number]) => change((s) => ({ ...s, pages: s.pages.map((p) => (p.id === page.id ? fn(p) : p)) }))
  const changeVisual = (id: string, fn: (v: Visual) => Visual) => changePage((p) => ({ ...p, visuals: p.visuals.map((v) => (v.id === id ? fn(v) : v)) }))

  const smartFields = (type: VisualType): Partial<Fields> => {
    if (!data) return {}
    const num = data.columns.find((c) => c.type === 'number')?.name ?? null
    const date = data.columns.find((c) => c.type === 'date')?.name ?? null
    const text = data.columns.find((c) => c.type === 'text')?.name ?? null
    const dim = (type === 'line' || type === 'area') ? date ?? text : text ?? date
    if (type === 'card') return { value: num, agg: num ? 'sum' : 'count' }
    if (type === 'table') return { columns: [dim, num].filter((c): c is string => !!c) }
    if (type === 'scatter') return { category: text, value: num, value2: data.columns.filter((c) => c.type === 'number')[1]?.name ?? num }
    if (type === 'text') return {}
    return { category: dim, value: num, agg: num ? 'sum' : 'count' }
  }

  const addVisual = (type: VisualType) => {
    const def = VISUALS.find((v) => v.type === type)!
    const v = newVisual(type, findSpot(page, def.w, def.h), smartFields(type), type === 'text' ? '' : def.label)
    changePage((p) => ({ ...p, visuals: [...p.visuals, v] }))
    setSelectedId(v.id); setRightTab('fields'); setEditing(true)
  }
  const duplicate = (id: string) => {
    const src = page.visuals.find((v) => v.id === id)
    if (!src) return
    const copy = { ...structuredClone(src), id: uid(), ...findSpot(page, src.w, src.h) }
    changePage((p) => ({ ...p, visuals: [...p.visuals, copy] }))
    setSelectedId(copy.id)
  }
  const remove = (id: string) => { changePage((p) => ({ ...p, visuals: p.visuals.filter((v) => v.id !== id) })); setSelectedId(null); if (cross?.visualId === id) setCross(null) }

  const accept = (d: Dataset, src: SavedSource) => {
    setData(d); setSource(src); setError(''); setCross(null); setDirty(true)
    if (title === 'Новый отчёт') setTitle(d.filename.replace(/\.(csv|xlsx|txt)$/i, ''))
    setNote(d.truncated ? `Загружены первые ${d.rows.length.toLocaleString('ru-RU')} строк${d.total_rows ? ` из ${d.total_rows.toLocaleString('ru-RU')}` : ''}.` : `Данные: ${d.rows.length.toLocaleString('ru-RU')} строк, ${d.columns.length} колонок.`)
  }
  const upload = async (file: File | undefined) => {
    if (!file) return
    setBusy('upload'); setError('')
    try { accept(await reportsApi.upload(orgId, file), { kind: 'file', label: file.name }) } catch (e) { fail(e) } finally { setBusy(null) }
  }

  const plan = async (e?: FormEvent, text = prompt) => {
    e?.preventDefault()
    if (!data || !text.trim()) return
    setBusy('plan'); setError('')
    try {
      const p = await reportsApi.plan(orgId, text.trim(), data.columns)
      const target = page.visuals.length ? { ...newPage(p.title.slice(0, 40) || 'ИИ-отчёт') } : page
      const visuals = planToVisuals(p.widgets, target)
      change((s) => (page.visuals.length ? { ...s, pages: [...s.pages, { ...target, visuals }] } : { ...s, pages: s.pages.map((x) => (x.id === page.id ? { ...x, visuals } : x)) }))
      setPageId(target.id); setPrompt('')
      if (title === 'Новый отчёт' || !reportId) setTitle((t) => (t === 'Новый отчёт' ? p.title : t))
      setNote(`План составил ${p.model}; числа посчитаны в браузере по вашим данным.${p.dropped ? ` Отброшено некорректных визуалов: ${p.dropped}.` : ''}`)
    } catch (err) { fail(err) } finally { setBusy(null) }
  }

  const save = async () => {
    setBusy('save'); setError('')
    const body = { title: title.trim() || 'Отчёт', spec, dataset: data, source }
    try {
      const r = reportId ? await biApi.update(orgId, reportId, body) : await biApi.create(orgId, body)
      setReportId(r.id); setDirty(false); setNote('Отчёт сохранён.')
    } catch (e) { fail(e) } finally { setBusy(null) }
  }
  const open = async (id: number) => {
    setOpenList(false); setBusy('open'); setError('')
    try {
      const r = await biApi.get<ReportSpec>(orgId, id)
      history.reset(r.spec); setPageId(r.spec.pages[0].id); setData(r.dataset); setSource(r.source); setReportId(r.id); setTitle(r.title)
      setSelectedId(null); setCross(null); setDirty(false); setEditing(false); setNote(`Открыт отчёт «${r.title}».`)
    } catch (e) { fail(e) } finally { setBusy(null) }
  }
  const refresh = async () => {
    const viaLink = source.kind === 'url' && !!source.url
    const viaWarehouse = source.kind === 'warehouse' && !!source.connection_id && !!source.entity
    if (!viaLink && !viaWarehouse) return
    setBusy('refresh'); setError('')
    try {
      const d = reportId && !dirty
        ? (await biApi.refresh<ReportSpec>(orgId, reportId)).dataset
        : viaLink ? await reportsApi.fromUrl(orgId, source.url!) : await reportsApi.warehouseLoad(orgId, source.connection_id!, source.entity!)
      if (d) { setData(d); setNote(`Данные обновлены: ${d.rows.length.toLocaleString('ru-RU')} строк.`) }
    } catch (e) { fail(e) } finally { setBusy(null) }
  }
  const close = () => { if (!dirty || window.confirm('Есть несохранённые изменения. Закрыть без сохранения?')) onClose?.() }

  const exportSelected = () => {
    if (!data || !selected) return
    const slicers = page.visuals.filter((v) => v.type === 'slicer')
    const rows = applyFilters(data.rows, visualFilters(selected, spec.filters, page.filters, slicers, cross), types)
    download(`${selected.format.title || 'visual'}.csv`, visualCsv(selected, data, rows, types))
  }

  // keyboard: undo/redo, delete, duplicate, nudge / resize with arrows
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.closest?.('input,textarea,select,[contenteditable]')
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key.toLowerCase() === 'z' && !typing) { e.preventDefault(); if (e.shiftKey) history.redo(); else history.undo(); return }
      if (mod && e.key.toLowerCase() === 'y' && !typing) { e.preventDefault(); history.redo(); return }
      if (typing || !editing || !selectedId) { if (e.key === 'Escape' && !typing && mode === 'overlay' && !selectedId) close(); return }
      if (e.key === 'Escape') setSelectedId(null)
      else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); remove(selectedId) }
      else if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); duplicate(selectedId) }
      else if (e.key.startsWith('Arrow')) {
        e.preventDefault()
        const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key] ?? [0, 0]
        changeVisual(selectedId, (v) => (e.shiftKey
          ? { ...v, w: Math.max(2, Math.min(12 - v.x, v.w + d[0])), h: Math.max(2, v.h + d[1]) }
          : { ...v, x: Math.max(0, Math.min(12 - v.w, v.x + d[0])), y: Math.max(0, v.y + d[1]) }))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  useEffect(() => {
    if (mode !== 'overlay') return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [mode])

  const tabBtn = (id: typeof rightTab, label: string) => <button type="button" role="tab" aria-selected={rightTab === id} onClick={() => setRightTab(id)} className={`flex-1 rounded-lg py-1.5 text-[12px] transition ${rightTab === id ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white'}`}>{label}</button>
  const iconBtn = 'grid h-8 w-8 place-items-center rounded-lg text-white/70 transition hover:bg-white/10 hover:text-white disabled:opacity-30'

  return (
    <div role={mode === 'overlay' ? 'dialog' : undefined} aria-modal={mode === 'overlay' || undefined} aria-label="BI-студия" className={`bi-studio glass-stage flex flex-col overflow-hidden ${mode === 'overlay' ? 'fixed inset-0 z-50' : 'relative h-[calc(100dvh-3.5rem)]'}`}>
      {/* top bar */}
      <header className="bi-noprint relative z-10 flex flex-wrap items-center gap-2 border-b border-white/[0.08] px-3 py-2 sm:px-4">
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#00e599]/15 text-[#00e599]"><LayoutGrid className="h-4 w-4" aria-hidden /></span>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/45">BI-студия{dirty ? ' · не сохранено' : reportId ? ' · сохранено' : ''}</p>
          <input aria-label="Название отчёта" value={title} maxLength={160} onChange={(e) => { setTitle(e.target.value); setDirty(true) }} className="w-full truncate bg-transparent text-[15px] font-medium text-white outline-none" />
        </div>
        <div className="flex items-center gap-0.5">
          <button type="button" aria-label="Отменить (Ctrl+Z)" title="Отменить (Ctrl+Z)" disabled={!history.canUndo} onClick={history.undo} className={iconBtn}><Undo2 className="h-4 w-4" /></button>
          <button type="button" aria-label="Повторить (Ctrl+Shift+Z)" title="Повторить" disabled={!history.canRedo} onClick={history.redo} className={iconBtn}><Redo2 className="h-4 w-4" /></button>
          <select aria-label="Тема" value={spec.theme} onChange={(e) => change((s) => ({ ...s, theme: e.target.value as ThemeId }))} className="ml-1 h-8 rounded-lg border border-white/10 bg-white/[0.04] px-2 text-[12px] text-white outline-none">
            {Object.values(THEMES).map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
          <button type="button" onClick={() => { setEditing((x) => !x); setSelectedId(null) }} className="glass-btn ml-1 py-1.5 text-[12px]">{editing ? <><Eye className="h-3.5 w-3.5" aria-hidden />Просмотр</> : <><Pencil className="h-3.5 w-3.5" aria-hidden />Редактировать</>}</button>
          {(source.kind === 'url' || source.kind === 'warehouse') && <button type="button" aria-label="Обновить данные" title={source.kind === 'url' ? 'Обновить данные по ссылке' : 'Обновить данные из хранилища'} disabled={busy !== null} onClick={() => void refresh()} className={iconBtn}><RefreshCw className={`h-4 w-4 ${busy === 'refresh' ? 'animate-spin' : ''}`} /></button>}
          <button type="button" aria-label="Открыть отчёт" title="Открыть" onClick={() => setOpenList(true)} className={iconBtn}><FolderOpen className="h-4 w-4" /></button>
          <button type="button" aria-label="Печать или PDF" title="Печать / PDF" onClick={() => window.print()} className={iconBtn}><Printer className="h-4 w-4" /></button>
          <button type="button" disabled={busy !== null} onClick={() => void save()} className="ml-1 inline-flex h-8 items-center gap-1.5 rounded-full bg-[#00e599] px-3.5 text-[12.5px] font-medium text-black transition hover:brightness-110 disabled:opacity-50"><Save className="h-3.5 w-3.5" aria-hidden />{busy === 'save' ? 'Сохраняю…' : 'Сохранить'}</button>
          {onClose && <button type="button" onClick={close} aria-label="Закрыть BI-студию" className="ml-1 grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-white/70 hover:text-white"><X className="h-4 w-4" /></button>}
        </div>
      </header>

      <div className="relative z-10 grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:overflow-hidden" style={{ gridTemplateColumns: undefined }}>
        <div className={`grid min-h-0 grid-cols-1 lg:h-full ${editing ? (leftOpen ? 'lg:grid-cols-[290px_minmax(0,1fr)_320px]' : 'lg:grid-cols-[44px_minmax(0,1fr)_320px]') : 'lg:grid-cols-[minmax(0,1fr)]'}`}>
          {/* left: data + AI */}
          {editing && (
            <aside className="bi-noprint min-h-0 border-white/[0.07] lg:overflow-y-auto lg:border-r">
              <button type="button" onClick={() => setLeftOpen((o) => !o)} aria-label={leftOpen ? 'Свернуть панель данных' : 'Развернуть панель данных'} className="hidden w-full items-center justify-end p-2 text-white/50 hover:text-white lg:flex">{leftOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</button>
              {leftOpen && (
                <div className="space-y-3 px-3 pb-4">
                  <section className="glass p-3">
                    <p className="flex items-center gap-2 text-[13px] font-medium text-white"><Database className="h-4 w-4 text-[#00e599]" aria-hidden />Данные</p>
                    <div className="mt-2.5 flex rounded-xl bg-black/30 p-1 text-[11.5px]" role="tablist" aria-label="Источник данных">
                      {([['warehouse', 'Хранилище'], ['file', 'Файл'], ['url', 'Ссылка'], ['onec', '1С'], ['postgres', 'Postgres']] as const).map(([id, label]) => (
                        <button key={id} type="button" role="tab" aria-selected={sourceKind === id} onClick={() => setSourceKind(id)} className={`flex-1 rounded-lg px-1 py-1.5 transition ${sourceKind === id ? 'bg-white/10 text-white' : 'text-white/50'}`}>{label}</button>
                      ))}
                    </div>
                    {sourceKind === 'file' && (
                      <>
                        <input ref={fileRef} type="file" accept=".csv,.xlsx,.txt" className="sr-only" aria-label="Файл с данными" onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = '' }} />
                        <button type="button" onClick={() => fileRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); void upload(e.dataTransfer.files[0]) }} className="mt-2.5 flex w-full flex-col items-center gap-1 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-3 py-4 text-center transition hover:border-[#00e599]/50">
                          <FileUp className="h-5 w-5 text-white/60" aria-hidden />
                          <span className="text-[12.5px] text-white">{busy === 'upload' ? 'Читаю файл…' : 'CSV или XLSX'}</span>
                          <span className="text-[11px] text-white/40">до 5 МБ, первая строка — заголовки</span>
                        </button>
                      </>
                    )}
                    {sourceKind === 'warehouse' && <WarehousePanel orgId={orgId} onLoaded={(d, e) => accept(d, { kind: 'warehouse', label: `${e.connection_name}: ${e.entity}`, connection_id: e.connection_id, entity: e.entity })} onError={fail} />}
                    {sourceKind === 'url' && <UrlPanel orgId={orgId} onLoaded={(d, url) => accept(d, { kind: 'url', label: url, url })} onError={fail} />}
                    {(sourceKind === 'onec' || sourceKind === 'postgres') && <SourcePanel key={sourceKind} orgId={orgId} kind={sourceKind} onLoaded={(d, label) => accept(d, { kind: sourceKind, label })} onError={fail} />}
                    {data && (
                      <>
                        <p className="mt-3 truncate text-[12px] text-white/70"><span className="text-[#00e599]">●</span> {source.label || data.filename}</p>
                        <ul className="mt-2 flex flex-wrap gap-1" aria-label="Поля данных">
                          {data.columns.map((c) => <li key={c.name} className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 font-mono text-[10.5px] text-white/65"><span className={c.type === 'number' ? 'text-[#00e599]' : c.type === 'date' ? 'text-[#5b8def]' : 'text-white/40'}>{c.type === 'number' ? '#' : c.type === 'date' ? '◷' : 'Aa'}</span> {c.name}</li>)}
                        </ul>
                      </>
                    )}
                  </section>

                  <section className="glass p-3">
                    <p className="flex items-center gap-2 text-[13px] font-medium text-white"><Sparkles className="h-4 w-4 text-[#00e599]" aria-hidden />Отчёт через ИИ</p>
                    {!data ? <p className="mt-2 text-[12px] text-white/45">Сначала подключите данные.</p> : (
                      <form onSubmit={(e) => void plan(e)} className="mt-2.5 space-y-2">
                        {!aiReady && <p className="text-[12px] text-[#e6b85c]">ИИ-модель не подключена — соберите отчёт вручную.</p>}
                        <div className="glass-input flex items-end gap-2 p-1.5">
                          <label htmlFor="bi-q" className="sr-only">Опишите отчёт</label>
                          <textarea id="bi-q" rows={3} value={prompt} maxLength={1000} onChange={(e) => setPrompt(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void plan() } }} placeholder="Например: выручка по месяцам и топ групп" className="min-h-[56px] flex-1 resize-none bg-transparent px-2 py-1 text-[12.5px] text-white outline-none placeholder:text-white/35" />
                          <button type="submit" disabled={!prompt.trim() || busy !== null || !aiReady} aria-label="Собрать отчёт" className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#00e599] text-black disabled:opacity-35"><ArrowUp className="h-4 w-4" aria-hidden /></button>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {IDEAS.map((q) => <button key={q} type="button" disabled={busy !== null || !aiReady} onClick={() => void plan(undefined, q)} className="glass-chip text-[11.5px] disabled:opacity-40">{q}</button>)}
                        </div>
                        <p className="text-[10.5px] leading-relaxed text-white/35">ИИ видит только названия колонок и по три примера значений; числа считаются в браузере.</p>
                      </form>
                    )}
                  </section>
                  {busy === 'plan' && <p className="flex items-center gap-2 px-1 text-[12px] text-white/70"><span className="glass-spinner" aria-hidden />ИИ проектирует отчёт…</p>}
                  {error && <p role="alert" className="glass border-[#e0645f]/40 px-3 py-2.5 text-[12.5px] text-[#f3a29f]">{error}</p>}
                  {note && !error && <p role="status" className="px-1 text-[11.5px] text-white/50">{note}</p>}
                </div>
              )}
            </aside>
          )}

          {/* canvas */}
          <main className="min-h-[420px] min-w-0 lg:overflow-y-auto" style={{ background: theme.canvas }} aria-label="Холст отчёта">
            {!editing && error && <p role="alert" className="mx-4 mt-3 text-[12.5px] text-[#f3a29f]">{error}</p>}
            <div className="p-2 sm:p-3">
              <Canvas
                page={page} reportFilters={spec.filters} data={data} types={types} theme={theme} editing={editing}
                selectedId={selectedId} cross={cross}
                onSelect={(id) => { setSelectedId(id); if (id && rightTab === 'filters') setRightTab('fields') }}
                onBox={(id, box) => changeVisual(id, (v) => ({ ...v, ...box }))}
                onCross={setCross}
                onSlicer={(id, values) => changeVisual(id, (v) => ({ ...v, selected: values }))}
                onDuplicate={duplicate}
                onDelete={remove}
              />
            </div>
          </main>

          {/* right: visuals / fields / format / filters */}
          {editing && (
            <aside className="bi-noprint min-h-0 border-white/[0.07] lg:overflow-y-auto lg:border-l">
              <div className="space-y-3 p-3">
                <section className="glass p-3">
                  <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-white/50">Добавить визуал</p>
                  <div className="mt-2 grid grid-cols-3 gap-1.5">
                    {VISUALS.map((v) => <button key={v.type} type="button" onClick={() => addVisual(v.type)} className="flex items-center gap-1 rounded-lg border border-white/10 px-1.5 py-1.5 text-left text-[11px] leading-tight text-white/70 transition hover:border-[#00e599]/50 hover:text-white"><Plus className="h-3 w-3 shrink-0 text-[#00e599]" aria-hidden />{v.label}</button>)}
                  </div>
                </section>
                <section className="glass p-3">
                  <div className="flex rounded-xl bg-black/30 p-1" role="tablist" aria-label="Панель свойств">
                    {tabBtn('fields', 'Поля')}{tabBtn('format', 'Формат')}{tabBtn('filters', 'Фильтры')}
                  </div>
                  <div className="mt-2">
                    {rightTab === 'filters' ? (
                      <FiltersPane data={data} types={types} pageFilters={page.filters} reportFilters={spec.filters}
                        onPage={(filters) => changePage((p) => ({ ...p, filters }))} onReport={(filters) => change((s) => ({ ...s, filters }))} />
                    ) : !selected ? (
                      <p className="py-3 text-[12px] leading-relaxed text-white/45">Выберите визуал на холсте, чтобы настроить поля и формат. Перетаскивайте визуалы мышью, тяните за зелёные ручки, чтобы менять размер; стрелки двигают, Shift+стрелки меняют размер, Delete удаляет, Ctrl+D дублирует.</p>
                    ) : rightTab === 'fields' ? (
                      <FieldsPane visual={selected} columns={data?.columns ?? []}
                        onType={(type) => changeVisual(selected.id, (v) => ({ ...v, type, format: { ...v.format, sort: type === 'line' || type === 'area' ? 'cat-asc' : v.format.sort, legend: (type === 'pie' || type === 'donut') && v.format.legend === 'none' ? 'right' : v.format.legend }, fields: { ...v.fields, ...(type === 'table' && !v.fields.columns.length ? { columns: [v.fields.category, v.fields.value].filter((c): c is string => !!c) } : {}) } }))}
                        onFields={(patch) => changeVisual(selected.id, (v) => ({ ...v, fields: { ...v.fields, ...patch } }))} />
                    ) : (
                      <FormatPane visual={selected} theme={theme} data={data} types={types} onFormat={(patch: Partial<Format>) => changeVisual(selected.id, (v) => ({ ...v, format: { ...v.format, ...patch } }))} />
                    )}
                  </div>
                  {selected && rightTab !== 'filters' && data && <button type="button" onClick={exportSelected} className="glass-btn mt-3 w-full justify-center text-[12px]"><Download className="h-3.5 w-3.5" aria-hidden />Данные визуала в CSV</button>}
                </section>
              </div>
            </aside>
          )}
        </div>
      </div>

      {/* pages */}
      <nav className="bi-noprint relative z-10 flex items-center gap-1 overflow-x-auto border-t border-white/[0.08] px-3 py-1.5" aria-label="Страницы отчёта">
        {spec.pages.map((p) => (
          <div key={p.id} className={`flex shrink-0 items-center rounded-lg ${p.id === page.id ? 'bg-white/10' : ''}`}>
            {renaming === p.id ? (
              <input autoFocus aria-label="Название страницы" defaultValue={p.name} maxLength={40} onBlur={(e) => { const name = e.target.value.trim() || p.name; change((s) => ({ ...s, pages: s.pages.map((x) => (x.id === p.id ? { ...x, name } : x)) })); setRenaming(null) }} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} className="h-7 w-32 rounded-md bg-black/40 px-2 text-[12px] text-white outline-none" />
            ) : (
              <button type="button" onClick={() => { setPageId(p.id); setSelectedId(null); setCross(null) }} onDoubleClick={() => editing && setRenaming(p.id)} className={`px-3 py-1.5 text-[12px] ${p.id === page.id ? 'text-white' : 'text-white/55 hover:text-white'}`} title="Двойной клик — переименовать">{p.name}</button>
            )}
            {editing && p.id === page.id && spec.pages.length > 1 && <button type="button" aria-label={`Удалить страницу «${p.name}»`} onClick={() => { const rest = spec.pages.filter((x) => x.id !== p.id); change((s) => ({ ...s, pages: rest })); setPageId(rest[0].id) }} className="pr-2 text-white/40 hover:text-[#f3a29f]"><X className="h-3 w-3" /></button>}
          </div>
        ))}
        {editing && <button type="button" onClick={() => { const np = newPage(`Страница ${spec.pages.length + 1}`); change((s) => ({ ...s, pages: [...s.pages, np] })); setPageId(np.id); setSelectedId(null) }} aria-label="Добавить страницу" className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-white/60 hover:bg-white/10 hover:text-white"><Plus className="h-4 w-4" /></button>}
        {cross && <button type="button" onClick={() => setCross(null)} className="ml-auto shrink-0 rounded-full border border-[#00e599]/40 px-2.5 py-1 text-[11px] text-[#00e599]">Фильтр: {cross.value} ✕</button>}
      </nav>

      {openList && <ReportsDialog orgId={orgId} onOpen={(id) => void open(id)} onClose={() => setOpenList(false)} onError={fail} />}
    </div>
  )
}
