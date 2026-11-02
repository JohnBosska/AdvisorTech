import { useEffect, useRef } from 'react'
import { prefersReducedMotion } from './useInView'

/** Hero background: vertical bars forming glowing "equalizer" clusters that drift across the panel. */
export function BarsCanvas() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current!
    const ctx = canvas.getContext('2d')!
    const reduced = prefersReducedMotion()
    let w = 0, h = 0, dpr = 1, raf = 0, visible = true
    const resize = () => {
      const r = canvas.getBoundingClientRect()
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      w = r.width; h = r.height
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr)
    }
    resize()
    const ro = new ResizeObserver(resize); ro.observe(canvas)
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting }); io.observe(canvas)

    const draw = (t: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)
      const gap = w < 640 ? 7 : 9
      const n = Math.floor(w / gap)
      const cy = h * 0.4
      // two glowing centres drifting in opposite directions
      const c1 = (0.5 + 0.38 * Math.sin(t * 0.00035)) * n
      const c2 = (0.5 + 0.42 * Math.sin(t * 0.00022 + 2.4)) * n
      for (let i = 0; i < n; i++) {
        const noise = (Math.sin(i * 0.9 + t * 0.002) + Math.sin(i * 0.37 - t * 0.0013) + 2) / 4
        const g = Math.exp(-Math.pow((i - c1) / (n * 0.06), 2)) + 0.8 * Math.exp(-Math.pow((i - c2) / (n * 0.045), 2))
        const base = 0.04 + 0.1 * noise
        const amp = Math.min(1, base + g * (0.55 + 0.45 * noise))
        const half = amp * h * 0.36
        const x = i * gap + gap / 2
        const a = Math.min(1, 0.12 + g * 0.9)
        ctx.strokeStyle = g > 0.15 ? `rgba(${52 + Math.round(60 * (1 - g))},213,${154 + Math.round(40 * g)},${a})` : `rgba(160,190,175,${0.12 + noise * 0.12})`
        ctx.lineWidth = g > 0.5 ? 2.2 : 1.4
        ctx.beginPath(); ctx.moveTo(x, cy - half); ctx.lineTo(x, cy + half); ctx.stroke()
      }
    }
    const loop = (t: number) => { if (visible && !document.hidden) draw(t); raf = requestAnimationFrame(loop) }
    if (reduced) draw(4000); else raf = requestAnimationFrame(loop)
    return () => { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect() }
  }, [])
  return <canvas ref={ref} className="absolute inset-0 h-full w-full" aria-hidden />
}
