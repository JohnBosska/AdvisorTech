import { useId } from 'react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, LabelList, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from 'recharts'
import { cardValue, categorySeries, distinctValues, formatValue, pivot, scatterPoints, tableRows } from './compute'
import { colorFor, type Theme } from './theme'
import type { CrossFilter, Dataset, Visual } from './types'

type Row = Dataset['rows'][number]
interface Props { v: Visual; rows: Row[]; allRows: Row[]; types: Record<string, string>; theme: Theme; cross: CrossFilter | null; onCross: (value: string | null) => void; onSlicer: (values: string[]) => void }

const AGG = { sum: 'Сумма', avg: 'Среднее', count: 'Количество', min: 'Минимум', max: 'Максимум' } as const

function Empty({ text, theme }: { text: string; theme: Theme }) {
  return <div className="grid h-full place-items-center px-3 text-center text-[12px]" style={{ color: theme.muted }}>{text}</div>
}

export function VisualView({ v, rows, allRows, types, theme, cross, onCross, onSlicer }: Props) {
  const gid = `g${useId().replace(/:/g, '')}`
  const f = v.fields
  const fmt = v.format
  const text = fmt.textColor || theme.text
  const fs = fmt.fontSize
  const val = (n: number) => formatValue(n, fmt.numberFormat, fmt.prefix, fmt.suffix)
  const axis = { stroke: theme.muted, fontSize: fs, tickLine: false, axisLine: false } as const
  const tip = { contentStyle: { background: theme.id === 'light' ? '#fff' : 'rgba(12,16,15,0.9)', border: `1px solid ${theme.border}`, borderRadius: 10, color: theme.text, fontSize: 12 }, formatter: (x: unknown) => (typeof x === 'number' ? val(x) : String(x ?? '')) }
  const mine = cross?.visualId === v.id ? cross.value : null
  const dim = (key: string) => (mine && mine !== key ? 0.3 : 1)
  const legend = fmt.legend === 'none' ? null : <Legend verticalAlign={fmt.legend === 'right' ? 'middle' : fmt.legend} align={fmt.legend === 'right' ? 'right' : 'center'} layout={fmt.legend === 'right' ? 'vertical' : 'horizontal'} wrapperStyle={{ fontSize: fs }} formatter={(value: unknown) => <span style={{ color: text }}>{String(value)}</span>} />
  const click = (key: unknown) => { if (typeof key === 'string') onCross(mine === key ? null : key) }

  if (v.type === 'text') return <div className="h-full overflow-auto whitespace-pre-wrap p-1 leading-snug" style={{ color: text, fontSize: fs + 3, textAlign: fmt.align }}>{fmt.text}</div>

  if (v.type === 'card') {
    if (!f.value && f.agg !== 'count') return <Empty theme={theme} text="Перетащите числовое поле в «Значение»" />
    return (
      <div className="flex h-full flex-col justify-center" style={{ textAlign: fmt.align }}>
        <p className="lp-display leading-none tracking-tight" style={{ color: fmt.color || text, fontSize: `clamp(20px, ${fs * 3}px, 64px)` }}>{val(cardValue(rows, f))}</p>
        <p className="mt-1.5 truncate" style={{ color: theme.muted, fontSize: fs }}>{AGG[f.agg]}{f.value ? ` · ${f.value}` : ''}</p>
      </div>
    )
  }

  if (v.type === 'slicer') {
    if (!f.category) return <Empty theme={theme} text="Выберите поле для среза" />
    const values = distinctValues(allRows, f.category, types)
    const sel = new Set(v.selected ?? [])
    return (
      <ul className="h-full space-y-0.5 overflow-auto pr-1" style={{ fontSize: fs + 1 }}>
        {values.map((x) => (
          <li key={x}>
            <label className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 hover:bg-fg/5" style={{ color: text }}>
              <input type="checkbox" className="accent-accent" checked={sel.has(x)} onChange={() => { const n = new Set(sel); if (n.has(x)) n.delete(x); else n.add(x); onSlicer([...n]) }} />
              <span className="truncate">{x}</span>
            </label>
          </li>
        ))}
      </ul>
    )
  }

  if (v.type === 'table') {
    if (!f.columns.length) return <Empty theme={theme} text="Добавьте поля в «Столбцы»" />
    const t = tableRows(rows, f, fmt, types)
    return (
      <div className="h-full overflow-auto">
        <table className="w-full border-collapse" style={{ fontSize: fs + 1, color: text }}>
          <thead className="sticky top-0" style={{ background: theme.id === 'light' ? '#fff' : theme.canvas }}>
            <tr>{t.headers.map((h) => <th key={h} className={`border-b px-2 py-1.5 font-medium ${t.numeric.has(h) ? 'text-right' : 'text-left'}`} style={{ borderColor: theme.border, color: theme.muted }}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {t.rows.map((r, i) => (
              <tr key={i} className="cursor-pointer" onClick={() => t.headers[0] && !t.numeric.has(t.headers[0]) && click(String(r[t.headers[0]]))} style={{ opacity: dim(String(r[t.headers[0]])) }}>
                {t.headers.map((h) => <td key={h} className={`border-b px-2 py-1 ${t.numeric.has(h) ? 'text-right font-mono' : ''}`} style={{ borderColor: theme.grid }}>{t.numeric.has(h) ? val(Number(r[h])) : String(r[h])}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  if (v.type === 'matrix') {
    if (!f.category) return <Empty theme={theme} text="Выберите поле «Строки»" />
    const p = pivot(rows, f, types)
    return (
      <div className="h-full overflow-auto">
        <table className="w-full border-collapse" style={{ fontSize: fs + 1, color: text }}>
          <thead className="sticky top-0" style={{ background: theme.id === 'light' ? '#fff' : theme.canvas }}>
            <tr>
              <th className="border-b px-2 py-1.5 text-left font-medium" style={{ borderColor: theme.border, color: theme.muted }}>{f.category}</th>
              {p.cols.map((c) => <th key={c} className="border-b px-2 py-1.5 text-right font-medium" style={{ borderColor: theme.border, color: theme.muted }}>{c}</th>)}
              {f.series && <th className="border-b px-2 py-1.5 text-right font-semibold" style={{ borderColor: theme.border }}>Итого</th>}
            </tr>
          </thead>
          <tbody>
            {p.rows.map((r) => (
              <tr key={r} className="cursor-pointer" onClick={() => click(r)} style={{ opacity: dim(r) }}>
                <td className="border-b px-2 py-1" style={{ borderColor: theme.grid }}>{r}</td>
                {p.cols.map((c) => <td key={c} className="border-b px-2 py-1 text-right font-mono" style={{ borderColor: theme.grid }}>{val(p.cells[r][c])}</td>)}
                {f.series && <td className="border-b px-2 py-1 text-right font-mono font-semibold" style={{ borderColor: theme.grid }}>{val(p.rowTotals[r])}</td>}
              </tr>
            ))}
            <tr className="font-semibold">
              <td className="px-2 py-1.5">Итого</td>
              {p.cols.map((c) => <td key={c} className="px-2 py-1.5 text-right font-mono">{val(p.colTotals[c])}</td>)}
              {f.series && <td className="px-2 py-1.5 text-right font-mono">{val(p.total)}</td>}
            </tr>
          </tbody>
        </table>
      </div>
    )
  }

  if (v.type === 'scatter') {
    if (!f.category || !f.value || !f.value2) return <Empty theme={theme} text="Нужны «Детализация», «Ось X» и «Ось Y»" />
    const pts = scatterPoints(rows, f, types)
    return (
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
          {fmt.grid && <CartesianGrid stroke={theme.grid} />}
          <XAxis type="number" dataKey="x" name={f.value} hide={!fmt.axisX} {...axis} tickFormatter={val} />
          <YAxis type="number" dataKey="y" name={f.value2} hide={!fmt.axisY} {...axis} tickFormatter={val} width={64} />
          <ZAxis range={[60, 60]} />
          <Tooltip {...tip} cursor={{ strokeDasharray: '3 3' }} />
          <Scatter isAnimationActive={false} data={pts} fill={fmt.color || theme.palette[0]} onClick={(d: unknown) => click((d as Record<string, unknown> | undefined)?.label)}>
            {pts.map((p) => <Cell key={p.label} fillOpacity={dim(p.label)} />)}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    )
  }

  if (!f.category) return <Empty theme={theme} text="Выберите поле «Ось»" />
  const sd = categorySeries(rows, f, fmt, types)
  if (!sd.data.length) return <Empty theme={theme} text="Нет данных с учётом фильтров" />
  const multi = !!f.series
  const color = (i: number, key: string) => colorFor(theme, i, key, fmt.colors, multi ? '' : fmt.color || (theme.id === 'neon' ? theme.accent : ''))

  if (v.type === 'pie' || v.type === 'donut') {
    const data = sd.data.map((d) => ({ name: String(d.category), value: Number(d.__total) }))
    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Tooltip {...tip} />
          {legend}
          <Pie isAnimationActive={false} data={data} dataKey="value" nameKey="name" innerRadius={v.type === 'donut' ? '58%' : 0} outerRadius={fmt.dataLabels ? '72%' : '88%'} paddingAngle={v.type === 'donut' ? 2 : 0} stroke={theme.id === 'light' ? '#fff' : theme.canvas} strokeWidth={2}
            label={fmt.dataLabels ? (p: { x?: number; y?: number; value?: unknown; textAnchor?: string }) => <text x={p.x} y={p.y} fill={text} fontSize={fs} textAnchor={p.textAnchor as 'start' | 'middle' | 'end'} dominantBaseline="central">{typeof p.value === 'number' ? val(p.value) : ''}</text> : false} labelLine={false} onClick={(d: unknown) => click((d as Record<string, unknown> | undefined)?.name)}>
            {data.map((d, i) => <Cell key={d.name} fill={colorFor(theme, i, d.name, fmt.colors)} fillOpacity={dim(d.name)} />)}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    )
  }

  const keys = sd.series
  const common = { data: sd.data, margin: { top: fmt.dataLabels ? 18 : 8, right: 12, bottom: 4, left: 0 } }
  const xa = <XAxis dataKey="category" hide={!fmt.axisX} {...axis} minTickGap={8} />
  const ya = <YAxis hide={!fmt.axisY} {...axis} tickFormatter={val} width={64} />
  const labels = (k: string) => fmt.dataLabels ? <LabelList dataKey={k} position="top" formatter={(x: unknown) => (typeof x === 'number' ? val(x) : '')} style={{ fill: text, fontSize: fs }} /> : null
  const name = (k: string) => (multi ? k : f.value ? `${AGG[f.agg]} · ${f.value}` : 'Количество')

  if (v.type === 'line' || v.type === 'area') {
    const Chart = v.type === 'line' ? LineChart : AreaChart
    return (
      <ResponsiveContainer width="100%" height="100%">
        <Chart {...common} onClick={(e: unknown) => click((e as Record<string, unknown> | undefined)?.activeLabel)}>
          <defs>{keys.map((k, i) => <linearGradient key={k} id={`${gid}${i}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color(i, k)} stopOpacity={0.35} /><stop offset="100%" stopColor={color(i, k)} stopOpacity={0} /></linearGradient>)}</defs>
          {fmt.grid && <CartesianGrid vertical={false} stroke={theme.grid} />}
          {xa}{ya}
          <Tooltip {...tip} />
          {legend}
          {keys.map((k, i) => v.type === 'line'
            ? <Line key={k} isAnimationActive={false} type={fmt.smooth ? 'monotone' : 'linear'} dataKey={k} name={name(k)} stroke={color(i, k)} strokeWidth={2} dot={false} activeDot={{ r: 4 }}>{labels(k)}</Line>
            : <Area key={k} isAnimationActive={false} type={fmt.smooth ? 'monotone' : 'linear'} dataKey={k} name={name(k)} stroke={color(i, k)} strokeWidth={2} fill={`url(#${gid}${i})`} stackId={multi ? 's' : undefined}>{labels(k)}</Area>)}
        </Chart>
      </ResponsiveContainer>
    )
  }

  const horizontal = v.type === 'barh'
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart {...common} layout={horizontal ? 'vertical' : 'horizontal'}>
        {fmt.grid && <CartesianGrid vertical={horizontal} horizontal={!horizontal} stroke={theme.grid} />}
        {horizontal ? <XAxis type="number" hide={!fmt.axisX} {...axis} tickFormatter={val} /> : xa}
        {horizontal ? <YAxis type="category" dataKey="category" hide={!fmt.axisY} {...axis} width={96} /> : ya}
        <Tooltip {...tip} cursor={{ fill: theme.grid }} />
        {legend}
        {keys.map((k, i) => (
          <Bar key={k} isAnimationActive={false} dataKey={k} name={name(k)} stackId={v.type === 'stacked' ? 's' : undefined} fill={color(i, k)} radius={v.type === 'stacked' ? 0 : horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]} maxBarSize={48} onClick={(d: unknown) => click((d as Record<string, unknown> | undefined)?.category)}>
            {sd.data.map((d) => <Cell key={String(d.category)} fill={multi ? color(i, k) : fmt.colors[String(d.category)] || color(0, k)} fillOpacity={dim(String(d.category))} />)}
            {fmt.dataLabels && <LabelList dataKey={k} position={horizontal ? 'right' : 'top'} formatter={(x: unknown) => (typeof x === 'number' ? val(x) : '')} style={{ fill: text, fontSize: fs }} />}
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}
