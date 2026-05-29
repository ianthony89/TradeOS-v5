import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon?:    ReactNode
  title:    string
  sub?:     string
  actions?: ReactNode
  className?: string
}

/** Polished empty state — used when holdings/watchlist/journal are empty. */
export function EmptyState({ icon, title, sub, actions, className = '' }: EmptyStateProps) {
  return (
    <div className={`empty-state ${className}`}>
      {icon && <div className="empty-state-icon">{icon}</div>}
      <div className="empty-state-title">{title}</div>
      {sub && <div className="empty-state-sub">{sub}</div>}
      {actions && <div className="empty-state-actions">{actions}</div>}
    </div>
  )
}
