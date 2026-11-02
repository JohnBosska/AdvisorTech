import { z } from 'zod'

const utf8Bytes = (v: string) => new TextEncoder().encode(v).length
const email = z.string().trim().min(1, 'Введите email').pipe(z.email('Некорректный email'))
const maxBytes = z.string().refine((v) => utf8Bytes(v) <= 72, 'Пароль не длиннее 72 байт')

export const loginSchema = z.object({ email, password: z.string().min(1, 'Введите пароль').and(maxBytes) })
export const registerSchema = z.object({
  name: z.string().trim().max(50, 'Не более 50 символов'),
  email,
  password: z.string().min(8, 'Не менее 8 символов').and(maxBytes),
})
export const verifySchema = z.object({ email, password: z.string().min(1, 'Введите пароль').and(maxBytes), code: z.string().regex(/^[0-9]{8}$/, 'Код состоит из 8 цифр') })

export type LoginValues = z.infer<typeof loginSchema>
export type RegisterValues = z.infer<typeof registerSchema>
export type VerifyValues = z.infer<typeof verifySchema>
