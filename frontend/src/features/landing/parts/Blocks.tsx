import type { ReactNode } from 'react'
import { useInView } from './useInView'

export const Label = ({ children }: { children: ReactNode }) => <p className="lp-label text-ink">{children}</p>

/** Neon-style statement: a grey lead phrase followed by the main sentence that darkens on scroll. */
export function TwoTone({ lead, children, className = '' }: { lead: string; children: ReactNode; className?: string }) {
  const [ref, on] = useInView<HTMLParagraphElement>()
  return (
    <p ref={ref} className={`lp-twotone ${on ? 'on' : ''} text-[clamp(1.5rem,2.6vw,2.25rem)] leading-[1.2] tracking-[-0.02em] ${className}`}>
      <span className="lead">{lead} </span><span className="rest">{children}</span>
    </p>
  )
}
