const BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')

export class ApiError extends Error {
  readonly status: number
  readonly retryAfter: number | null
  readonly requestId: string | null

  constructor(status: number, detail: string, retryAfter: number | null = null, requestId: string | null = null) {
    super(detail)
    this.name = 'ApiError'
    this.status = status
    this.retryAfter = retryAfter
    this.requestId = requestId
  }
}

let tokenGetter: () => string | null = () => null
let unauthorizedHandler: () => void = () => {}

export function configureApiClient(opts: { getToken?: () => string | null; onUnauthorized?: () => void }) {
  if (opts.getToken) tokenGetter = opts.getToken
  if (opts.onUnauthorized) unauthorizedHandler = opts.onUnauthorized
}

interface RequestOptions {
  method?: 'GET' | 'POST'
  body?: unknown
  signal?: AbortSignal
  /** A 401 here means bad credentials, not an expired session. */
  skipUnauthorizedHandler?: boolean
}

export async function apiRequest<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json'
  const token = tokenGetter()
  if (token) headers.Authorization = `Bearer ${token}`

  let response: Response
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      signal: opts.signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new ApiError(0, 'network')
  }

  if (response.ok) return (await response.json()) as T

  let detail = ''
  try {
    const payload = (await response.json()) as { detail?: unknown }
    if (typeof payload.detail === 'string') detail = payload.detail
  } catch {
    /* non-JSON error body */
  }
  const retry = Number(response.headers.get('Retry-After'))
  const error = new ApiError(response.status, detail, Number.isFinite(retry) && retry > 0 ? retry : null, response.headers.get('X-Request-ID'))
  if (response.status === 401 && !opts.skipUnauthorizedHandler) unauthorizedHandler()
  throw error
}

/** Russian user-facing message. Never exposes backend `detail` for 5xx. */
export function describeApiError(error: unknown): string {
  if (!(error instanceof ApiError)) return 'Что-то пошло не так. Попробуйте ещё раз.'
  switch (error.status) {
    case 0:
      return 'Нет связи с сервером. Проверьте подключение.'
    case 400:
      return 'Неверный или просроченный код.'
    case 401:
      return 'Неверный email или пароль.'
    case 403:
      return 'Недостаточно прав или email не подтверждён.'
    case 404:
      return 'Не найдено.'
    case 409:
      return 'Этот email уже зарегистрирован или подтверждён.'
    case 422:
      return 'Проверьте введённые данные.'
    case 429:
      return error.retryAfter ? `Слишком часто. Повторите через ${error.retryAfter} с.` : 'Слишком часто. Повторите позже.'
    case 503:
      return 'Сервис временно недоступен: вход или почта не настроены.'
    default:
      return 'Ошибка сервера. Попробуйте позже.'
  }
}
