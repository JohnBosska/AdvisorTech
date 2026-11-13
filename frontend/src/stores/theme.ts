import { useEffect, useSyncExternalStore } from 'react'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

export type AppTheme = 'light' | 'dark' | 'system'

interface ThemeState { theme: AppTheme; setTheme: (t: AppTheme) => void }

// The app (workspace) theme. Report pages have their own, independent theme in the report spec.
export const useThemeStore = create<ThemeState>()(
  persist((set) => ({ theme: 'dark', setTheme: (theme) => set({ theme }) }), {
    name: 'ta-app-theme',
    storage: createJSONStorage(() => {
      try { return window.localStorage } catch { return sessionStorage }
    }),
  }),
)

const query = () => (typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: light)') : null)
function subscribeSystem(cb: () => void) {
  const mq = query()
  mq?.addEventListener('change', cb)
  return () => mq?.removeEventListener('change', cb)
}
const systemLight = () => !!query()?.matches

/** The theme actually in effect ('system' resolved through the OS setting). */
export function useResolvedTheme(): 'light' | 'dark' {
  const theme = useThemeStore((s) => s.theme)
  const light = useSyncExternalStore(subscribeSystem, systemLight, () => false)
  return theme === 'system' ? (light ? 'light' : 'dark') : theme
}

/** Applies the app theme to <html> while the workspace is mounted; the landing stays dark. */
export function useApplyAppTheme() {
  const resolved = useResolvedTheme()
  useEffect(() => {
    const el = document.documentElement
    el.dataset.theme = resolved
    return () => { delete el.dataset.theme }
  }, [resolved])
  return resolved
}
