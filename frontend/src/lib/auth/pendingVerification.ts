// Credentials needed by /email/verify after registration: memory only, never router state/URL/storage.
let pending: { email: string; password: string } | null = null
export const pendingVerification = {
  set(value: { email: string; password: string }) { pending = value },
  get: () => pending,
  clear() { pending = null },
}
