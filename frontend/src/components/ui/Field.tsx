import { forwardRef, useId, type InputHTMLAttributes, type SelectHTMLAttributes } from 'react'

interface Shared { label: string; error?: string; hint?: string }
const control = (error?: string) =>
  `h-10 w-full rounded-[var(--radius-md)] border bg-surface-1 px-3 text-sm text-white placeholder:text-muted/70 transition-colors hover:border-border-strong ${error ? 'border-danger' : 'border-border'}`

function Wrapper({ id, label, error, hint, children }: Shared & { id: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] text-text-soft">{label}</label>
      {children}
      {error ? <p id={`${id}-d`} className="text-xs text-danger">{error}</p> : hint ? <p id={`${id}-d`} className="text-xs text-muted">{hint}</p> : null}
    </div>
  )
}

export const Field = forwardRef<HTMLInputElement, Shared & InputHTMLAttributes<HTMLInputElement>>(function Field(
  { label, error, hint, className = '', ...props }, ref) {
  const id = useId()
  return (
    <Wrapper id={id} label={label} error={error} hint={hint}>
      <input ref={ref} id={id} aria-invalid={error ? true : undefined} aria-describedby={error || hint ? `${id}-d` : undefined} className={`${control(error)} ${className}`} {...props} />
    </Wrapper>
  )
})

export const SelectField = forwardRef<HTMLSelectElement, Shared & SelectHTMLAttributes<HTMLSelectElement>>(function SelectField(
  { label, error, hint, className = '', children, ...props }, ref) {
  const id = useId()
  return (
    <Wrapper id={id} label={label} error={error} hint={hint}>
      <select ref={ref} id={id} aria-invalid={error ? true : undefined} className={`${control(error)} ${className}`} {...props}>{children}</select>
    </Wrapper>
  )
})
