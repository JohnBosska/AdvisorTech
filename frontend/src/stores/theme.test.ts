import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { useApplyAppTheme, useThemeStore } from './theme'

afterEach(() => { act(() => useThemeStore.getState().setTheme('dark')); window.localStorage.clear() })

describe('app theme', () => {
  it('applies to <html>, persists, and is removed when the workspace unmounts', () => {
    const { unmount } = renderHook(() => useApplyAppTheme())
    expect(document.documentElement.dataset.theme).toBe('dark')
    act(() => useThemeStore.getState().setTheme('light'))
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(JSON.parse(window.localStorage.getItem('ta-app-theme')!).state.theme).toBe('light')
    unmount()
    expect(document.documentElement.dataset.theme).toBeUndefined()
  })

  it('resolves "system" through the OS preference (dark when unknown)', () => {
    act(() => useThemeStore.getState().setTheme('system'))
    const { result } = renderHook(() => useApplyAppTheme())
    expect(result.current).toBe('dark')
  })
})
