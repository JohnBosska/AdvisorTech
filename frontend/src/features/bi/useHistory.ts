import { useCallback, useState } from 'react'

/** Snapshot undo/redo. Every `set` is one step; 60 steps are kept. */
export function useHistory<T>(initial: T) {
  const [h, setH] = useState({ past: [] as T[], present: initial, future: [] as T[] })
  const set = useCallback((next: T | ((prev: T) => T)) => setH((s) => {
    const value = typeof next === 'function' ? (next as (p: T) => T)(s.present) : next
    if (value === s.present) return s
    return { past: [...s.past, s.present].slice(-60), present: value, future: [] }
  }), [])
  const undo = useCallback(() => setH((s) => (s.past.length ? { past: s.past.slice(0, -1), present: s.past[s.past.length - 1], future: [s.present, ...s.future] } : s)), [])
  const redo = useCallback(() => setH((s) => (s.future.length ? { past: [...s.past, s.present], present: s.future[0], future: s.future.slice(1) } : s)), [])
  const reset = useCallback((value: T) => setH({ past: [], present: value, future: [] }), [])
  return { state: h.present, set, undo, redo, reset, canUndo: h.past.length > 0, canRedo: h.future.length > 0 }
}
