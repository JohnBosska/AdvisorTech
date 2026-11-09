import '@testing-library/jest-dom/vitest'

// jsdom has no ResizeObserver; layout-dependent components only need it to exist.
if (!('ResizeObserver' in globalThis)) {
  ;(globalThis as Record<string, unknown>).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }
}
