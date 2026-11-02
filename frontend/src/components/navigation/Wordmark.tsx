import { Link } from 'react-router-dom'
import { PRODUCT_NAME } from '../../config/brand'

export function LogoMark({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="7" fill="#0b0d0c" stroke="#26292d" />
      <path d="M8 11h16M16 11v13" stroke="#34d59a" strokeWidth="3" strokeLinecap="round" />
      <circle cx="24" cy="23" r="2" fill="#62ddeb" />
    </svg>
  )
}

export function Wordmark({ to = '/', className = '' }: { to?: string; className?: string }) {
  return (
    <Link to={to} className={`inline-flex items-center gap-2.5 font-semibold tracking-tight ${className}`}>
      <LogoMark />
      <span>{PRODUCT_NAME}</span>
    </Link>
  )
}
