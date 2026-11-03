import { useEffect, useRef } from 'react'
import { prefersReducedMotion } from './useInView'

type Line = { h: number; w: number; gap: number; tone: 'em' | 'lime' | 'amber' | 'white' | 'teal'; o: number }
type Group = { left: string; width: string; depth: 'far' | 'mid' | 'near'; lines: Line[]; delay: number; mobile: boolean }

/** Deterministic pseudo-random so the composition is identical on every render and in tests. */
function rng(seed: number) {
  let s = seed
  return () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296)
}
const TONES: Line['tone'][] = ['em', 'em', 'em', 'teal', 'lime', 'white', 'amber']

function makeGroup(seed: number, count: number, h: [number, number], warm: boolean): Line[] {
  const r = rng(seed)
  return Array.from({ length: count }, (_, i) => ({
    h: h[0] + r() * (h[1] - h[0]),
    w: r() > 0.82 ? 3 : r() > 0.5 ? 2 : 1,
    gap: 4 + Math.round(r() * 14),
    tone: warm && i % 4 === 0 ? 'amber' : TONES[Math.floor(r() * TONES.length)],
    o: 0.35 + r() * 0.65,
  }))
}

const GROUPS: Group[] = [
  { left: '-4%', width: '34%', depth: 'far', lines: makeGroup(11, 26, [38, 92], true), delay: 0, mobile: true },
  { left: '30%', width: '22%', depth: 'mid', lines: makeGroup(23, 16, [28, 74], false), delay: -6, mobile: false },
  { left: '52%', width: '26%', depth: 'near', lines: makeGroup(37, 18, [44, 100], true), delay: -11, mobile: true },
  { left: '78%', width: '26%', depth: 'far', lines: makeGroup(53, 24, [30, 86], true), delay: -3, mobile: false },
]

const TONE_VAR: Record<Line['tone'], string> = {
  em: 'var(--cine-emerald)', lime: 'var(--cine-lime)', amber: 'var(--cine-amber)', white: 'var(--cine-champagne)', teal: '#2fb8a0',
}

/** Atmospheric backdrop: ambient light, groups of thin vertical beams, grain. Pure CSS; pointer parallax only. */
export function LightStructures() {
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = root.current
    if (!el || prefersReducedMotion() || !window.matchMedia('(pointer: fine)').matches) return
    let raf = 0
    const move = (e: PointerEvent) => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        el.style.setProperty('--px', String(e.clientX / window.innerWidth - 0.5))
        el.style.setProperty('--py', String(e.clientY / window.innerHeight - 0.5))
      })
    }
    window.addEventListener('pointermove', move, { passive: true })
    return () => { window.removeEventListener('pointermove', move); cancelAnimationFrame(raf) }
  }, [])

  return (
    <div ref={root} className="cine" aria-hidden>
      <div className="cine-glow cine-glow-a" />
      <div className="cine-glow cine-glow-b" />
      <div className="cine-glow cine-glow-c" />
      {GROUPS.map((g, gi) => (
        <div key={gi} className={`cine-group cine-${g.depth}${g.mobile ? '' : ' cine-hide-sm'}`} style={{ left: g.left, width: g.width, animationDelay: `${g.delay}s` }}>
          {g.lines.map((l, li) => (
            <i key={li} style={{ height: `${l.h}%`, width: l.w, marginRight: l.gap, opacity: l.o, ['--tone' as string]: TONE_VAR[l.tone] }} />
          ))}
        </div>
      ))}
      <div className="cine-floor" />
      <div className="cine-grain" />
    </div>
  )
}
