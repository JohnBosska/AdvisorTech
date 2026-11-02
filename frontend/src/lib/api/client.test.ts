import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, apiRequest, configureApiClient, describeApiError } from './client'

afterEach(() => vi.restoreAllMocks())
const mockFetch = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status, headers })))

describe('apiRequest', () => {
  it('sends bearer token and parses JSON', async () => {
    configureApiClient({ getToken: () => 'tok' })
    mockFetch(200, { id: 1 })
    await expect(apiRequest('/x')).resolves.toEqual({ id: 1 })
    expect((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].headers.Authorization).toBe('Bearer tok')
  })
  it('maps 429 with Retry-After', async () => {
    mockFetch(429, { detail: 'slow' }, { 'Retry-After': '42' })
    const err = (await apiRequest('/x').catch((e) => e)) as ApiError
    expect(err).toBeInstanceOf(ApiError)
    expect(err.retryAfter).toBe(42)
    expect(describeApiError(err)).toContain('42')
  })
  it('calls onUnauthorized on 401 unless skipped', async () => {
    const onUnauthorized = vi.fn()
    configureApiClient({ onUnauthorized })
    mockFetch(401, { detail: 'no' })
    await apiRequest('/x').catch(() => {})
    mockFetch(401, { detail: 'no' })
    await apiRequest('/x', { skipUnauthorizedHandler: true }).catch(() => {})
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
  })
  it('never leaks backend detail for 5xx', () => {
    expect(describeApiError(new ApiError(500, 'secret stack'))).not.toContain('secret')
  })
})
