import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { authApi, type CurrentUser } from '../api/auth'
import { ApiError, configureApiClient } from '../api/client'

// Interim strategy: the backend has no refresh/logout/cookies, so the bearer token lives in
// sessionStorage (cleared with the tab and on any 401). Never localStorage, URL or logs.
const STORAGE_KEY = 'ta.access_token'

function readToken(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}
function writeToken(token: string | null) {
  try {
    if (token) sessionStorage.setItem(STORAGE_KEY, token)
    else sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    /* storage unavailable: session lasts until reload */
  }
}

let memoryToken: string | null = readToken()
configureApiClient({ getToken: () => memoryToken })

interface AuthContextValue {
  user: CurrentUser | null
  isAuthenticated: boolean
  isLoading: boolean
  signIn: (token: string) => void
  signOut: () => void
}
const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [token, setToken] = useState<string | null>(memoryToken)

  const signOut = useCallback(() => {
    memoryToken = null
    writeToken(null)
    setToken(null)
    queryClient.clear()
  }, [queryClient])

  const signIn = useCallback((next: string) => {
    memoryToken = next
    writeToken(next)
    setToken(next)
  }, [])

  useEffect(() => {
    configureApiClient({ onUnauthorized: signOut })
  }, [signOut])

  const me = useQuery({
    queryKey: ['auth', 'me', token],
    queryFn: ({ signal }) => authApi.me(signal),
    enabled: token !== null,
    retry: (count, error) => !(error instanceof ApiError && error.status === 401) && count < 2,
    staleTime: 60_000,
  })

  const value = useMemo<AuthContextValue>(
    () => ({ user: me.data ?? null, isAuthenticated: token !== null, isLoading: token !== null && me.isPending, signIn, signOut }),
    [token, me.data, me.isPending, signIn, signOut],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
