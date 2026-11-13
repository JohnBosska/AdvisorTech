import { Check } from 'lucide-react'
import { useState } from 'react'
import type { Stage } from '../../lib/api/ai'
import { EDGES, edgeState, STAGE_DEFS, STATUS_LABEL, statusMap, type NodeStatus } from './rag'

const COLORS: Record<NodeStatus, { stroke: string; text: string; dot: string }> = {
  idle: { stroke: 'var(--color-border)', text: 'var(--color-muted)', dot: 'var(--color-border-strong)' },
  queued: { stroke: 'var(--color-border-strong)', text: 'var(--color-text-soft)', dot: 'var(--color-muted)' },
  running: { stroke: 'var(--color-accent)', text: 'var(--color-fg)', dot: 'var(--color-accent)' },
  completed: { stroke: 'color-mix(in srgb, var(--color-accent) 45%, transparent)', text: 'var(--color-fg)', dot: 'var(--color-accent)' },
  warning: { stroke: 'color-mix(in srgb, var(--color-warning) 55%, transparent)', text: 'var(--color-warning)', dot: 'var(--color-warning)' },
  failed: { stroke: 'color-mix(in srgb, var(--color-danger) 55%, transparent)', text: 'var(--color-danger)', dot: 'var(--color-danger)' },
  skipped: { stroke: 'var(--color-border)', text: 'color-mix(in srgb, var(--color-muted) 60%, transparent)', dot: 'var(--color-border)' },
}
const EDGE_COLOR = { idle: 'var(--color-border)', active: 'var(--color-accent)', done: 'color-mix(in srgb, var(--color-accent) 45%, transparent)', muted: 'color-mix(in srgb, var(--color-border) 60%, transparent)' } as const
const H = 30

const byId = Object.fromEntries(STAGE_DEFS.map((d) => [d.id, d]))

function edgePath(from: string, to: string) {
  const a = byId[from], b = byId[to]
  const y1 = a.y + H / 2, y2 = b.y - H / 2, m = (y1 + y2) / 2
  return `M ${a.x} ${y1} C ${a.x} ${m}, ${b.x} ${m}, ${b.x} ${y2}`
}

function ms(value?: number | null) {
  return value === undefined || value === null ? '—' : value < 1000 ? `${value} мс` : `${(value / 1000).toFixed(1)} с`
}

interface Props {
  stages: Record<string, Stage>
  started: boolean
  running: boolean
  caption: string
  durationMs?: number | null
  error?: string | null
}

export function PipelineColumn({ stages, started, running, caption, durationMs, error }: Props) {
  const [selected, setSelected] = useState<string | null>(null)
  const statuses = statusMap(Object.values(stages), started || running)
  const def = selected ? byId[selected] : null
  const stage = selected ? stages[selected] : undefined

  return (
    <section aria-label="Выполнение RAG" className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <header className="flex items-start justify-between gap-4 px-6 pt-6">
        <div className="min-w-0">
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">Выполнение RAG</p>
          <p className="mt-1 truncate text-sm text-text-soft" title={caption}>{caption || 'Задайте вопрос — здесь появится путь запроса'}</p>
        </div>
        <span className={`shrink-0 rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider ${running ? 'border-accent/50 text-accent-ink' : error ? 'border-danger/50 text-danger' : 'border-border text-muted'}`}>
          {running ? 'идёт' : error ? 'ошибка' : started ? `готово · ${ms(durationMs)}` : 'ожидание'}
        </span>
      </header>

      {/* Desktop: SVG graph */}
      <div className="relative hidden min-h-0 flex-1 lg:block">
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-60" style={{ backgroundImage: 'repeating-linear-gradient(to right, color-mix(in srgb, var(--color-fg) 4%, transparent) 0 1px, transparent 1px 44px)' }} />
        <svg viewBox="0 0 460 750" className="relative mx-auto h-full max-h-[760px] w-full" role="group" aria-label="Схема этапов RAG">
          <defs>
            <filter id="glow" x="-30%" y="-80%" width="160%" height="260%"><feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          </defs>
          {EDGES.map(([from, to]) => {
            const state = edgeState(statuses[from], statuses[to])
            return (
              <g key={`${from}-${to}`}>
                <path d={edgePath(from, to)} fill="none" stroke={EDGE_COLOR[state]} strokeWidth={state === 'active' ? 1.6 : 1} className={state === 'active' ? 'dash-flow' : undefined} data-edge-state={state} />
                <circle cx={byId[to].x} cy={byId[to].y - H / 2} r="2.5" fill={EDGE_COLOR[state]} />
                <circle cx={byId[from].x} cy={byId[from].y + H / 2} r="2.5" fill={EDGE_COLOR[state]} />
              </g>
            )
          })}
          {STAGE_DEFS.map((d) => {
            const status = statuses[d.id]
            const c = COLORS[status]
            const active = selected === d.id
            return (
              <g
                key={d.id}
                role="button"
                tabIndex={0}
                aria-label={`${d.label}: ${STATUS_LABEL[status]}`}
                aria-pressed={active}
                data-stage={d.id}
                data-status={status}
                onClick={() => setSelected(active ? null : d.id)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(active ? null : d.id) } }}
                className="cursor-pointer outline-none [&:focus-visible>rect]:stroke-white"
              >
                <rect x={d.x - d.w / 2} y={d.y - H / 2} width={d.w} height={H} rx={H / 2} fill="var(--color-surface-1)" stroke={active ? 'var(--color-fg)' : c.stroke} strokeDasharray={status === 'skipped' ? '3 3' : undefined} filter={status === 'running' ? 'url(#glow)' : undefined} />
                <circle cx={d.x - d.w / 2 + 14} cy={d.y} r="3.2" fill={c.dot}>
                  {status === 'running' && <animate attributeName="opacity" values="1;0.25;1" dur="1.2s" repeatCount="indefinite" />}
                </circle>
                <text x={d.x + 6} y={d.y + 3.5} textAnchor="middle" fill={c.text} fontFamily="Geist Mono, ui-monospace, monospace" fontSize="9.5" letterSpacing="0.6">{d.label}</text>
              </g>
            )
          })}
        </svg>
      </div>

      {/* Mobile / tablet: vertical timeline */}
      <ol className="mt-4 space-y-1 px-4 pb-4 lg:hidden" aria-label="Этапы выполнения">
        {STAGE_DEFS.map((d) => {
          const status = statuses[d.id]
          return (
            <li key={d.id} className="flex items-start gap-3 rounded-[var(--radius-md)] border border-border-subtle px-3 py-2" data-status={status}>
              <span className="mt-1 grid h-4 w-4 shrink-0 place-items-center rounded-full border" style={{ borderColor: COLORS[status].dot }}>
                {status === 'completed' ? <Check className="h-2.5 w-2.5 text-accent-ink" aria-hidden /> : <span className="h-1.5 w-1.5 rounded-full" style={{ background: COLORS[status].dot }} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="font-mono text-[11px]" style={{ color: COLORS[status].text }}>{d.label}</span>
                <span className="block text-xs text-muted">{stages[d.id]?.summary ?? STATUS_LABEL[status]}</span>
              </span>
              <span className="font-mono text-[10px] text-muted">{ms(stages[d.id]?.duration_ms)}</span>
            </li>
          )
        })}
      </ol>

      {/* Details of the clicked node */}
      <div className="hidden border-t border-border bg-surface-1/80 px-6 py-4 lg:block" aria-live="polite">
        {def ? (
          <div className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-1 text-sm">
            <p className="font-mono text-[12px] uppercase tracking-wider text-text-soft">{def.label}</p>
            <p className="text-right font-mono text-[11px]" style={{ color: COLORS[statuses[def.id]].text }}>{STATUS_LABEL[statuses[def.id]]}</p>
            <p className="col-span-2 text-[13px] text-muted">{def.description}</p>
            {stage?.summary && <p className="col-span-2 text-[13px] text-text-soft">{stage.summary}</p>}
            <p className="col-span-2 mt-1 font-mono text-[11px] text-muted">
              Время: {ms(stage?.duration_ms)}{stage?.count !== undefined && stage.count !== null ? ` · элементов: ${stage.count}` : ''}
            </p>
          </div>
        ) : (
          <p className="text-[13px] text-muted">Нажмите на этап, чтобы увидеть, что он делает и сколько занял.</p>
        )}
      </div>
    </section>
  )
}
