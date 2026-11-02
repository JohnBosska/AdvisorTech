import { create } from 'zustand'

export type PeriodKey = 'M1' | 'Q1' | 'M6' | 'M12'

interface UiState {
  sidebarCollapsed: boolean
  period: PeriodKey
  toggleSidebar: () => void
  setPeriod: (p: PeriodKey) => void
}

// Client-only UI state. Server data lives in TanStack Query, never here.
export const useUi = create<UiState>((set) => ({
  sidebarCollapsed: false,
  period: 'Q1',
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setPeriod: (period) => set({ period }),
}))
