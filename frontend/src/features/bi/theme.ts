import type { ThemeId } from './types'

export interface Theme { id: ThemeId; label: string; canvas: string; card: string; text: string; muted: string; grid: string; border: string; accent: string; palette: string[]; glass: boolean }

// Palettes validated for CVD separation, lightness band and contrast against their surface.
const DARK = ['#00a370', '#5b8def', '#b5862f', '#9a7bf0', '#e0645f', '#2a9fb0']
export const THEMES: Record<ThemeId, Theme> = {
  neon: { id: 'neon', label: 'Neon (тёмная)', canvas: '#050807', card: 'rgba(255,255,255,0.045)', text: '#f4f6f5', muted: 'rgba(255,255,255,0.5)', grid: 'rgba(255,255,255,0.07)', border: 'rgba(255,255,255,0.1)', accent: '#00e599', palette: DARK, glass: true },
  light: { id: 'light', label: 'Светлая', canvas: '#eef1f0', card: '#ffffff', text: '#101413', muted: '#5f6866', grid: '#e6eae9', border: '#dde3e1', accent: '#00875a', palette: ['#00875a', '#3f6fd8', '#b0700e', '#7c5cd6', '#d0453f', '#0a8aa8'], glass: false },
  contrast: { id: 'contrast', label: 'Контрастная', canvas: '#000000', card: '#000000', text: '#ffffff', muted: '#c8c8c8', grid: 'rgba(255,255,255,0.18)', border: '#ffffff', accent: '#00e599', palette: DARK, glass: false },
}

export function colorFor(theme: Theme, index: number, key: string, overrides: Record<string, string>, single = ''): string {
  return overrides[key] || (index === 0 && single) || theme.palette[index % theme.palette.length]
}

export function hexWithOpacity(hex: string, opacity: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex)
  if (!m) return hex
  const n = parseInt(m[1], 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(100, opacity)) / 100})`
}
