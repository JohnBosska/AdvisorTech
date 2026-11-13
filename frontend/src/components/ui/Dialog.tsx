import { X } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'

interface DialogProps { open: boolean; onClose: () => void; title: string; description?: string; children: ReactNode; wide?: boolean }

/** Native <dialog>: focus trap, Esc and backdrop handled by the browser. */
export function Dialog({ open, onClose, title, description, children, wide }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) el.showModal()
    if (!open && el.open) el.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => { if (e.target === ref.current) onClose() }}
      aria-labelledby="dlg-title"
      className={`m-auto w-[calc(100%-2rem)] ${wide ? 'max-w-3xl' : 'max-w-lg'} rounded-[var(--radius-lg)] border border-border-strong bg-surface-2 p-0 text-fg shadow-2xl`}
    >
      {open && (
        <div className="rise p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id="dlg-title" className="text-lg font-semibold tracking-tight">{title}</h2>
              {description && <p className="mt-1 text-sm text-muted">{description}</p>}
            </div>
            <button type="button" onClick={onClose} aria-label="Закрыть" className="rounded p-1 text-muted hover:text-fg"><X className="h-4 w-4" /></button>
          </div>
          <div className="mt-5">{children}</div>
        </div>
      )}
    </dialog>
  )
}
