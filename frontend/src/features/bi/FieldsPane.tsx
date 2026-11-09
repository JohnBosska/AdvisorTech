import type { Aggregation, DatasetColumn } from '../../lib/api/reports'
import { Row, Section, Select, inputCls } from './controls'
import { VISUALS, type Fields, type Visual, type VisualType } from './types'

const AGGS: { id: Aggregation; label: string }[] = [
  { id: 'sum', label: 'Сумма' }, { id: 'avg', label: 'Среднее' }, { id: 'count', label: 'Количество' }, { id: 'min', label: 'Минимум' }, { id: 'max', label: 'Максимум' },
]
const ICON: Record<string, string> = { number: '#', date: '◷', text: 'Aa' }

function FieldSelect({ label, value, columns, allowEmpty = true, onChange }: { label: string; value: string | null; columns: DatasetColumn[]; allowEmpty?: boolean; onChange: (v: string | null) => void }) {
  return (
    <Row label={label}>
      <select aria-label={label} value={value ?? ''} onChange={(e) => onChange(e.target.value || null)} className={inputCls}>
        {allowEmpty && <option value="">— не выбрано —</option>}
        {columns.map((c) => <option key={c.name} value={c.name}>{ICON[c.type]} {c.name}</option>)}
      </select>
    </Row>
  )
}

export function FieldsPane({ visual, columns, onType, onFields }: { visual: Visual; columns: DatasetColumn[]; onType: (t: VisualType) => void; onFields: (f: Partial<Fields>) => void }) {
  const f = visual.fields
  const numbers = columns.filter((c) => c.type === 'number')
  const dims = columns.filter((c) => c.type !== 'number')
  const t = visual.type
  const agg = <Select label="Агрегация" value={f.agg} options={AGGS} onChange={(agg) => onFields({ agg })} />
  return (
    <div>
      <Section title="Тип визуала">
        <div className="grid grid-cols-3 gap-1.5">
          {VISUALS.map((v) => (
            <button key={v.type} type="button" aria-pressed={t === v.type} onClick={() => onType(v.type)} className={`rounded-lg border px-1.5 py-1.5 text-[11px] leading-tight transition ${t === v.type ? 'border-[#00e599]/60 bg-[#00e599]/10 text-white' : 'border-white/10 text-white/60 hover:text-white'}`}>{v.label}</button>
          ))}
        </div>
      </Section>
      {columns.length === 0 ? <p className="py-3 text-[12px] text-white/45">Сначала подключите данные слева.</p> : (
        <Section title="Поля">
          {t === 'card' && <><FieldSelect label="Значение" value={f.value} columns={numbers} onChange={(value) => onFields({ value, agg: value ? (f.agg === 'count' ? 'sum' : f.agg) : 'count' })} />{agg}</>}
          {['bar', 'stacked', 'barh', 'line', 'area'].includes(t) && (
            <>
              <FieldSelect label="Ось" value={f.category} columns={columns} onChange={(category) => onFields({ category })} />
              <FieldSelect label="Легенда (серии)" value={f.series} columns={dims} onChange={(series) => onFields({ series })} />
              <FieldSelect label="Значение" value={f.value} columns={numbers} onChange={(value) => onFields({ value })} />
              {agg}
            </>
          )}
          {(t === 'pie' || t === 'donut') && <><FieldSelect label="Категория" value={f.category} columns={dims} onChange={(category) => onFields({ category })} /><FieldSelect label="Значение" value={f.value} columns={numbers} onChange={(value) => onFields({ value })} />{agg}</>}
          {t === 'scatter' && <><FieldSelect label="Детализация" value={f.category} columns={dims} onChange={(category) => onFields({ category })} /><FieldSelect label="Ось X" value={f.value} columns={numbers} onChange={(value) => onFields({ value })} /><FieldSelect label="Ось Y" value={f.value2} columns={numbers} onChange={(value2) => onFields({ value2 })} />{agg}</>}
          {t === 'matrix' && <><FieldSelect label="Строки" value={f.category} columns={dims} onChange={(category) => onFields({ category })} /><FieldSelect label="Столбцы" value={f.series} columns={dims} onChange={(series) => onFields({ series })} /><FieldSelect label="Значения" value={f.value} columns={numbers} onChange={(value) => onFields({ value })} />{agg}</>}
          {t === 'slicer' && <FieldSelect label="Поле" value={f.category} columns={dims} onChange={(category) => onFields({ category })} />}
          {t === 'table' && (
            <>
              <p className="text-[11px] text-white/45">Столбцы: текстовые группируют строки, числовые агрегируются.</p>
              <ul className="max-h-56 space-y-0.5 overflow-auto">
                {columns.map((c) => (
                  <li key={c.name}>
                    <label className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 text-[12px] text-white/75 hover:bg-white/5">
                      <input type="checkbox" className="accent-[#00e599]" checked={f.columns.includes(c.name)} onChange={(e) => onFields({ columns: e.target.checked ? [...f.columns, c.name] : f.columns.filter((x) => x !== c.name) })} />
                      <span className="w-5 text-center font-mono text-[10px] text-white/40">{ICON[c.type]}</span><span className="truncate">{c.name}</span>
                    </label>
                  </li>
                ))}
              </ul>
              {agg}
            </>
          )}
          {t === 'text' && <p className="text-[12px] text-white/45">Текст редактируется на вкладке «Формат».</p>}
        </Section>
      )}
    </div>
  )
}
