import { useCallback, useState, type PointerEvent as RPointerEvent } from 'react'

interface PanelState { width: number; collapsed: boolean }

function load(key: string, fallback: PanelState): PanelState {
  try {
    const raw = window.localStorage.getItem(`ta-bi-panel-${key}`)
    if (raw) return { ...fallback, ...JSON.parse(raw) }
  } catch { /* private mode or blocked storage: use defaults */ }
  return fallback
}

/** A resizable, collapsible side panel whose state survives reloads (per browser). */
export function usePanel(key: string, side: 'left' | 'right', { width = 290, min = 220, max = 520 } = {}) {
  const [state, setState] = useState<PanelState>(() => load(key, { width, collapsed: false }))
  const persist = useCallback((next: PanelState) => {
    setState(next)
    try { window.localStorage.setItem(`ta-bi-panel-${key}`, JSON.stringify(next)) } catch { /* ignore */ }
  }, [key])

  const toggle = () => persist({ ...state, collapsed: !state.collapsed })

  const startResize = (e: RPointerEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startW = state.width
    let last = startW
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - startX
      last = Math.max(min, Math.min(max, startW + (side === 'left' ? dx : -dx)))
      setState((s) => ({ ...s, width: last }))
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      persist({ width: last, collapsed: false })
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const nudge = (delta: number) => persist({ ...state, width: Math.max(min, Math.min(max, state.width + delta)) })

  return { ...state, toggle, startResize, nudge }
}
