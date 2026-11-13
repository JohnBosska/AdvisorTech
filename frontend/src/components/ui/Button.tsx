import { Link, type LinkProps } from 'react-router-dom'
import type { ButtonHTMLAttributes, AnchorHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

const base =
  'inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] font-medium whitespace-nowrap transition-colors disabled:opacity-45 disabled:pointer-events-none'
const sizes: Record<Size, string> = { sm: 'h-8 px-3 text-[13px]', md: 'h-10 px-4 text-sm', lg: 'h-12 px-6 text-[15px]' }
const variants: Record<Variant, string> = {
  primary: 'bg-accent text-accent-contrast hover:bg-accent-strong',
  secondary: 'border border-border-strong bg-transparent text-fg hover:bg-surface-3',
  ghost: 'text-muted hover:text-fg hover:bg-surface-3',
  danger: 'border border-danger/50 text-danger hover:bg-danger/10',
}
export const buttonClass = (variant: Variant = 'primary', size: Size = 'md', extra = '') =>
  `${base} ${sizes[size]} ${variants[variant]} ${extra}`

interface Common { variant?: Variant; size?: Size }

export function Button({ variant = 'primary', size = 'md', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & Common) {
  return <button className={buttonClass(variant, size, className)} {...props} />
}
export function LinkButton({ variant = 'primary', size = 'md', className = '', ...props }: LinkProps & Common) {
  return <Link className={buttonClass(variant, size, className)} {...props} />
}
export function AnchorButton({ variant = 'secondary', size = 'md', className = '', ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & Common) {
  return <a className={buttonClass(variant, size, className)} {...props} />
}
