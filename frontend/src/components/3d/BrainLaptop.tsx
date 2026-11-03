import { Suspense, lazy, useEffect, useRef, useState } from 'react'

const Scene = lazy(() => import('./BrainLaptopScene'))

function webglAvailable() {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

/** Static non-WebGL fallback: also used while the 3D chunk loads. */
function Fallback({ note }: { note?: string }) {
  return (
    <div className="relative grid h-full w-full place-items-center" role="img" aria-label="Открытый ноутбук, на экране — мозг из светящихся нулей и единиц">
      <div className="w-[78%] max-w-md">
        <div className="aspect-[16/10] rounded-t-xl border-[6px] border-[#1c1f26] bg-[#020507] p-3 shadow-[0_0_80px_rgb(52_213_154/0.15)]">
          <div className="grid h-full place-items-center font-mono text-[10px] leading-3 text-accent/70 break-all" aria-hidden>
            {'0 1 0 1 1 0 { } 0 1 / 1 0 1 ; 0 1 0 1 1 0 1 < > 0 1 0 1 1 = 0 1 0 1 # 1 0 1 0'.repeat(3)}
          </div>
        </div>
        <div className="h-2 rounded-b-lg bg-gradient-to-b from-[#2a2c2f] to-[#16171a]" />
      </div>
      {note && <p className="sr-only">{note}</p>}
    </div>
  )
}

/** Hero visual. The whole laptop is an accessible button: click / tap / Enter / Space scatters and reassembles the brain. */
export function BrainLaptop() {
  const host = useRef<HTMLDivElement>(null)
  const trigger = useRef<(() => void) | null>(null)
  const [active, setActive] = useState(true)
  const [gl] = useState(webglAvailable)
  const [reduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const points = typeof window !== 'undefined' && window.innerWidth < 768 ? 7000 : 14000

  useEffect(() => {
    const el = host.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setActive(e.isIntersecting && !document.hidden))
    io.observe(el)
    const onVis = () => setActive(!document.hidden)
    document.addEventListener('visibilitychange', onVis)
    return () => { io.disconnect(); document.removeEventListener('visibilitychange', onVis) }
  }, [])

  return (
    <div
      ref={host}
      role="button"
      tabIndex={0}
      aria-label="Интерактивный ноутбук: нажмите, чтобы рассыпать и снова собрать мозг из символов"
      onClick={() => trigger.current?.()}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); trigger.current?.() } }}
      className="relative aspect-[5/4] w-full cursor-pointer rounded-[var(--radius-lg)] outline-offset-4 lg:aspect-[7/6]"
    >
      <div className="absolute inset-0" style={{ maskImage: 'radial-gradient(ellipse 50% 50% at 50% 50%, #000 66%, transparent 100%)', WebkitMaskImage: 'radial-gradient(ellipse 50% 50% at 50% 50%, #000 66%, transparent 100%)' }}>
      {gl ? (
        <Suspense fallback={<Fallback />}>
          <Scene reducedMotion={reduced} points={points} active={active} trigger={trigger} />
        </Suspense>
      ) : (
        <Fallback note="3D-сцена недоступна в этом браузере" />
      )}
      </div>
    </div>
  )
}

export default BrainLaptop
