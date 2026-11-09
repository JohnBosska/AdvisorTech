import { Copy, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import { applyFilters, visualFilters } from './compute'
import { hexWithOpacity, type Theme } from './theme'
import { GRID_COLS, ROW_PX, type CrossFilter, type Dataset, type Filter, type Page, type Visual } from './types'
import { VisualView } from './VisualView'

type Box = Pick<Visual, 'x' | 'y' | 'w' | 'h'>
type Mode = 'move' | 'e' | 's' | 'se'
interface Props {
  page: Page; reportFilters: Filter[]; data: Dataset | null; types: Record<string, string>; theme: Theme; editing: boolean
  selectedId: string | null; cross: CrossFilter | null
  onSelect: (id: string | null) => void; onBox: (id: string, box: Box) => void; onCross: (c: CrossFilter | null) => void
  onSlicer: (id: string, values: string[]) => void; onDuplicate: (id: string) => void; onDelete: (id: string) => void
}

const clamp = (b: Box): Box => {
  const w = Math.max(2, Math.min(GRID_COLS, b.w))
  return { w, h: Math.max(2, Math.min(60, b.h)), x: Math.max(0, Math.min(GRID_COLS - w, b.x)), y: Math.max(0, b.y) }
}

export function Canvas(p: Props) {
  const host = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(900)
  const [draft, setDraft] = useState<{ id: string; box: Box } | null>(null)

  useEffect(() => {
    const el = host.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const narrow = width < 640
  const col = width / GRID_COLS
  const slicers = p.page.visuals.filter((v) => v.type === 'slicer')
  const rowsFor = (v: Visual) => (p.data ? applyFilters(p.data.rows, visualFilters(v, p.reportFilters, p.page.filters, slicers, p.cross), p.types) : [])
  const bottom = p.page.visuals.reduce((m, v) => Math.max(m, v.y + v.h), 0)

  const start = (e: RPointerEvent, v: Visual, mode: Mode) => {
    if (!p.editing || narrow || e.button !== 0) return
    if (mode === 'move' && (e.target as HTMLElement).closest('input,button,textarea,select,label')) return
    p.onSelect(v.id)
    const sx = e.clientX, sy = e.clientY
    const origin: Box = { x: v.x, y: v.y, w: v.w, h: v.h }
    let moved = false
    let last = origin
    const move = (ev: PointerEvent) => {
      const dx = Math.round((ev.clientX - sx) / col), dy = Math.round((ev.clientY - sy) / ROW_PX)
      if (!moved && Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) < 5) return
      moved = true
      last = clamp(mode === 'move' ? { ...origin, x: origin.x + dx, y: origin.y + dy } : { ...origin, w: origin.w + (mode !== 's' ? dx : 0), h: origin.h + (mode !== 'e' ? dy : 0) })
      setDraft({ id: v.id, box: last })
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      setDraft(null)
      if (moved) p.onBox(v.id, last)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  return (
    <div ref={host} className="relative w-full" style={{ minHeight: narrow ? undefined : Math.max(bottom + 8, 22) * ROW_PX }} onPointerDown={(e) => { if (e.target === e.currentTarget) p.onSelect(null) }}>
      {p.editing && !narrow && <div className="pointer-events-none absolute inset-0 opacity-60" style={{ backgroundImage: `radial-gradient(${p.theme.grid} 1px, transparent 1px)`, backgroundSize: `${col}px ${ROW_PX}px` }} aria-hidden />}
      <div className={narrow ? 'space-y-3' : ''}>
        {p.page.visuals.map((v) => {
          const box = draft?.id === v.id ? draft.box : v
          const sel = p.editing && p.selectedId === v.id
          const f = v.format
          const bg = f.background ? hexWithOpacity(f.background, f.bgOpacity) : p.theme.card
          const style = narrow
            ? { height: Math.max(v.h, v.type === 'card' ? 4 : 8) * ROW_PX }
            : { left: box.x * col + 6, top: box.y * ROW_PX + 6, width: box.w * col - 12, height: box.h * ROW_PX - 12 }
          return (
            <section
              key={v.id}
              aria-label={f.title || 'Визуал'}
              onPointerDown={(e) => start(e, v, 'move')}
              className={`group ${narrow ? 'relative' : 'absolute'} flex flex-col overflow-hidden p-3 transition-shadow ${p.theme.glass && !f.background ? 'bi-glass' : ''} ${p.editing && !narrow ? 'cursor-move' : ''} ${draft?.id === v.id ? 'z-20 opacity-90 shadow-2xl' : sel ? 'z-10' : ''}`}
              style={{ ...style, background: bg, borderRadius: f.radius, border: f.border ? `1px solid ${f.borderColor || p.theme.border}` : '1px solid transparent', outline: sel ? `2px solid ${p.theme.accent}` : undefined, outlineOffset: 1 }}
            >
              {f.showTitle && <p className="mb-1.5 shrink-0 truncate font-medium" style={{ fontSize: f.titleSize, color: f.titleColor || p.theme.text, textAlign: f.align }}>{f.title || 'Без названия'}</p>}
              <div className="min-h-0 flex-1">
                <VisualView v={v} rows={rowsFor(v)} allRows={p.data?.rows ?? []} types={p.types} theme={p.theme} cross={p.cross}
                  onCross={(value) => p.onCross(value === null || !(v.type === 'scatter' || v.type === 'table' || v.fields.category) ? null : { visualId: v.id, column: v.type === 'table' ? v.fields.columns.find((c) => p.types[c] !== 'number') ?? '' : v.fields.category!, value })}
                  onSlicer={(values) => p.onSlicer(v.id, values)} />
              </div>
              {sel && !narrow && (
                <>
                  <div className="absolute right-2 top-2 flex gap-1">
                    <button type="button" aria-label="Дублировать визуал" onClick={() => p.onDuplicate(v.id)} className="grid h-7 w-7 place-items-center rounded-lg bg-black/60 text-white/80 hover:text-white"><Copy className="h-3.5 w-3.5" /></button>
                    <button type="button" aria-label="Удалить визуал" onClick={() => p.onDelete(v.id)} className="grid h-7 w-7 place-items-center rounded-lg bg-black/60 text-white/80 hover:text-[#f3a29f]"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                  <span onPointerDown={(e) => { e.stopPropagation(); start(e, v, 'e') }} className="absolute right-0 top-1/2 h-10 w-2 -translate-y-1/2 cursor-ew-resize rounded-l bg-[#00e599]/70" aria-hidden />
                  <span onPointerDown={(e) => { e.stopPropagation(); start(e, v, 's') }} className="absolute bottom-0 left-1/2 h-2 w-10 -translate-x-1/2 cursor-ns-resize rounded-t bg-[#00e599]/70" aria-hidden />
                  <span onPointerDown={(e) => { e.stopPropagation(); start(e, v, 'se') }} className="absolute bottom-0 right-0 h-3.5 w-3.5 cursor-nwse-resize rounded-tl bg-[#00e599]" aria-hidden />
                </>
              )}
            </section>
          )
        })}
      </div>
      {p.page.visuals.length === 0 && (
        <div className="absolute inset-0 grid place-items-center p-6 text-center text-[13px]" style={{ color: p.theme.muted }}>
          <p>Пустая страница. Добавьте визуал справа или попросите ИИ собрать отчёт.</p>
        </div>
      )}
    </div>
  )
}
