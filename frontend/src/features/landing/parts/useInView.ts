import { useEffect, useRef, useState } from 'react'

/** True once the element has entered the viewport; `repeat` toggles it back when it leaves. */
export function useInView<T extends Element>(opts: { repeat?: boolean; margin?: string } = {}) {
  const ref = useRef<T>(null)
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) setSeen(true)
      else if (opts.repeat) setSeen(false)
    }, { rootMargin: opts.margin ?? '0px 0px -15% 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [opts.repeat, opts.margin])
  return [ref, seen] as const
}

export const prefersReducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
