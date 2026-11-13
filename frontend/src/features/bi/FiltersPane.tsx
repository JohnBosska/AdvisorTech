import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import type { DatasetColumn } from '../../lib/api/reports'
import { distinctValues } from './compute'
import { Row, inputCls } from './controls'
import { uid, type Dataset, type Filter } from './types'

function FilterCard({ f, columns, data, types, onChange, onRemove }: { f: Filter; columns: DatasetColumn[]; data: Dataset; types: Record<string, string>; onChange: (f: Filter) => void; onRemove: () => void }) {
  const type = types[f.column]
  const values = f.column ? distinctValues(data.rows, f.column, types) : []
  const [q, setQ] = useState('')
  const toDate = (ms: number | null) => (ms === null ? '' : new Date(ms).toISOString().slice(0, 10))
  return (
    <div className="space-y-2 rounded-xl border border-fg/10 bg-fg/[0.03] p-2.5">
      <div className="flex items-center gap-2">
        <select aria-label="Поле фильтра" value={f.column} onChange={(e) => { const c = e.target.value; onChange({ ...f, column: c, kind: types[c] === 'text' ? 'values' : 'range', values: [], min: null, max: null }) }} className={inputCls}>
          <option value="">— поле —</option>
          {columns.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
        </select>
        <button type="button" aria-label="Удалить фильтр" onClick={onRemove} className="text-fg/45 hover:text-danger"><Trash2 className="h-3.5 w-3.5" /></button>
      </div>
      {f.column && type !== 'text' && (
        <div className="flex gap-1.5">
          {(['values', 'range'] as const).map((k) => <button key={k} type="button" onClick={() => onChange({ ...f, kind: k, values: [], min: null, max: null })} className={`glass-chip ${f.kind === k ? 'on' : ''}`}>{k === 'values' ? 'Значения' : 'Диапазон'}</button>)}
        </div>
      )}
      {f.column && f.kind === 'range' && (
        <div className="grid grid-cols-2 gap-1.5">
          {type === 'date' ? (
            <>
              <input type="date" aria-label="С даты" value={toDate(f.min)} onChange={(e) => onChange({ ...f, min: e.target.value ? Date.parse(e.target.value) : null })} className={inputCls} />
              <input type="date" aria-label="По дату" value={toDate(f.max)} onChange={(e) => onChange({ ...f, max: e.target.value ? Date.parse(e.target.value) : null })} className={inputCls} />
            </>
          ) : (
            <>
              <input type="number" aria-label="От" placeholder="от" value={f.min ?? ''} onChange={(e) => onChange({ ...f, min: e.target.value === '' ? null : Number(e.target.value) })} className={inputCls} />
              <input type="number" aria-label="До" placeholder="до" value={f.max ?? ''} onChange={(e) => onChange({ ...f, max: e.target.value === '' ? null : Number(e.target.value) })} className={inputCls} />
            </>
          )}
        </div>
      )}
      {f.column && f.kind === 'values' && (
        <>
          {values.length > 8 && <input aria-label="Поиск значения" placeholder="Поиск" value={q} onChange={(e) => setQ(e.target.value)} className={inputCls} />}
          <ul className="max-h-40 space-y-0.5 overflow-auto">
            {values.filter((v) => !q || v.toLowerCase().includes(q.toLowerCase())).map((v) => (
              <li key={v}>
                <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-[12px] text-fg/75 hover:bg-fg/5">
                  <input type="checkbox" className="accent-accent" checked={f.values.includes(v)} onChange={(e) => onChange({ ...f, values: e.target.checked ? [...f.values, v] : f.values.filter((x) => x !== v) })} />
                  <span className="truncate">{v}</span>
                </label>
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-fg/40">{f.values.length ? `Выбрано: ${f.values.length}` : 'Ничего не выбрано — фильтр не действует'}</p>
        </>
      )}
    </div>
  )
}

export function FiltersPane({ data, types, pageFilters, reportFilters, onPage, onReport }: { data: Dataset | null; types: Record<string, string>; pageFilters: Filter[]; reportFilters: Filter[]; onPage: (f: Filter[]) => void; onReport: (f: Filter[]) => void }) {
  if (!data) return <p className="py-3 text-[12px] text-fg/45">Сначала подключите данные.</p>
  const block = (title: string, list: Filter[], set: (f: Filter[]) => void) => (
    <div className="space-y-2 border-b border-fg/[0.07] py-3 last:border-0">
      <Row label={title}><span /></Row>
      {list.map((f) => <FilterCard key={f.id} f={f} columns={data.columns} data={data} types={types} onChange={(n) => set(list.map((x) => (x.id === f.id ? n : x)))} onRemove={() => set(list.filter((x) => x.id !== f.id))} />)}
      <button type="button" onClick={() => set([...list, { id: uid(), column: '', kind: 'values', values: [], min: null, max: null }])} className="glass-btn w-full justify-center text-[12px]"><Plus className="h-3.5 w-3.5" aria-hidden />Добавить фильтр</button>
    </div>
  )
  return (
    <div>
      {block('Фильтры страницы', pageFilters, onPage)}
      {block('Фильтры всего отчёта', reportFilters, onReport)}
      <p className="pt-2 text-[11px] leading-relaxed text-fg/40">Клик по столбцу, сектору или строке фильтрует остальные визуалы страницы; повторный клик снимает выбор. Срезы фильтруют всю страницу.</p>
    </div>
  )
}
