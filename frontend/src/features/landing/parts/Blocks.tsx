import type { ReactNode } from 'react'
import { useInView } from './useInView'

export const Label = ({ children }: { children: ReactNode }) => <p className="lp-label text-ink">{children}</p>

/** Neon-style statement: a grey lead phrase followed by the main sentence that darkens on scroll. */
export function TwoTone({ lead, children, className = '' }: { lead: string; children: ReactNode; className?: string }) {
  const [ref, on] = useInView<HTMLParagraphElement>()
  return (
    <p ref={ref} className={`lp-twotone ${on ? 'on' : ''} text-[clamp(1.5rem,2.6vw,2.25rem)] leading-[1.2] tracking-[-0.02em] ${className}`}>
      <span className="lead">{lead} </span><span className="rest">{children}</span>
    </p>
  )
}

/** Dotted/halftone icon whose dots flip in a wave (Neon pricing-section style). */
export function DotIcon({ kind }: { kind: 'burst' | 'bars' | 'ring' | 'wave' }) {
  const n = 7
  const cells: { x: number; y: number; d: number; keep: boolean }[] = []
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const cx = x - 3, cy = y - 3, r = Math.hypot(cx, cy)
    const keep = kind === 'burst' ? (x + y) % 2 === 0 || r < 1.5 : kind === 'bars' ? y >= n - 1 - ((x * 3) % 6) : kind === 'ring' ? Math.abs(r - 2.8) < 0.7 : Math.abs(cy - Math.sin(x) * 2) < 0.9
    cells.push({ x, y, d: (x + y) * 0.12, keep })
  }
  return (
    <svg viewBox="0 0 70 70" className="h-14 w-14" aria-hidden>
      {cells.map((c, i) => <circle key={i} cx={5 + c.x * 10} cy={5 + c.y * 10} r={c.keep ? 2.4 : 0.8} fill="#0b0d0c" style={{ animation: c.keep ? `flip 2.8s ${c.d}s infinite` : undefined, opacity: c.keep ? 1 : 0.35 }} />)}
    </svg>
  )
}
