'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, AlertTriangle } from 'lucide-react'

export interface ToastData {
  title:   string
  detail?: string
  tone?:   'success' | 'error'
}

interface ToastProps extends ToastData {
  /** Called when the toast should disappear (after `duration` or on click). */
  onClose:   () => void
  /** Auto-dismiss delay in ms. Default 3000. */
  duration?: number
}

/**
 * Non-blocking, auto-dismissing toast. Renders into document.body via a
 * portal so it never disturbs layout. Not a modal — it does not trap focus
 * or block interaction. Disappears after `duration` (default 3s) or on click.
 */
export function Toast({ title, detail, tone = 'success', onClose, duration = 3000 }: ToastProps) {
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    const fade = setTimeout(() => setLeaving(true), duration - 220)
    const done = setTimeout(onClose, duration)
    return () => { clearTimeout(fade); clearTimeout(done) }
  }, [onClose, duration])

  // Rendered only after a user action (client-side), so document is available.
  if (typeof document === 'undefined') return null

  return createPortal(
    <div className="toast-host" aria-live="polite">
      <div
        className={`toast toast--${tone}${leaving ? ' toast--leaving' : ''}`}
        role="status"
        onClick={onClose}
      >
        <span className="toast-icon">
          {tone === 'error' ? <AlertTriangle size={15} /> : <Check size={15} />}
        </span>
        <div className="toast-body">
          <span className="toast-title">{title}</span>
          {detail && <span className="toast-detail">{detail}</span>}
        </div>
      </div>
    </div>,
    document.body,
  )
}
