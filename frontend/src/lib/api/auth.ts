import { apiRequest } from './client'

export interface AccessToken { access_token: string; token_type: string; user_id: number }
export interface CurrentUser { id: number; name: string | null; phone: string | null; birthday_date: string | null; role: string }
export interface Credentials { email: string; password: string }

export const authApi = {
  me: (signal?: AbortSignal) => apiRequest<CurrentUser>('/api/v1/auth/me', { signal }),
  register: (body: Credentials & { name?: string | null }) =>
    apiRequest<{ detail: string }>('/api/v1/auth/email/register', { method: 'POST', body }),
  verify: (body: Credentials & { code: string }) =>
    apiRequest<AccessToken>('/api/v1/auth/email/verify', { method: 'POST', body }),
  resend: (body: Credentials) => apiRequest<{ detail: string }>('/api/v1/auth/email/resend', { method: 'POST', body }),
  login: (body: Credentials) =>
    apiRequest<AccessToken>('/api/v1/auth/email/login', { method: 'POST', body, skipUnauthorizedHandler: true }),
}
