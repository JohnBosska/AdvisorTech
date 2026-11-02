import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { routes } from '../../app/router'
import { AuthProvider } from '../../lib/auth/AuthProvider'

function setup(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AuthProvider><RouterProvider router={router} /></AuthProvider>
    </QueryClientProvider>,
  )
  return router
}
afterEach(() => { vi.restoreAllMocks(); sessionStorage.clear() })

describe('auth screens', () => {
  it('redirects anonymous users from /app to /login', async () => {
    const router = setup('/app')
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
  })
  it('validates the register form client-side', async () => {
    setup('/register')
    await userEvent.type(screen.getByLabelText('Email'), 'bad')
    await userEvent.type(screen.getByLabelText('Пароль'), 'short')
    await userEvent.click(screen.getByRole('button', { name: 'Получить код' }))
    expect(await screen.findByText('Некорректный email')).toBeInTheDocument()
    expect(screen.getByText('Не менее 8 символов')).toBeInTheDocument()
  })
  it('goes to verification when login returns 403', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail: 'x' }), { status: 403 })))
    const router = setup('/login')
    await userEvent.type(screen.getByLabelText('Email'), 'a@b.co')
    await userEvent.type(screen.getByLabelText('Пароль'), 'password1')
    await userEvent.click(screen.getByRole('button', { name: 'Войти' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/verify'))
    expect(screen.getByLabelText('Email')).toHaveValue('a@b.co')
  })
  it('shows a mapped error for wrong credentials', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail: 'x' }), { status: 401 })))
    setup('/login')
    await userEvent.type(screen.getByLabelText('Email'), 'a@b.co')
    await userEvent.type(screen.getByLabelText('Пароль'), 'password1')
    await userEvent.click(screen.getByRole('button', { name: 'Войти' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Неверный email или пароль')
  })
})
