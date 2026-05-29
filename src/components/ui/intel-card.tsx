import type { ReactNode } from 'react'
import { AlertTriangle, Info, TrendingDown, ShieldAlert } from 'lucide-react'

export type IntelSeverity = 'critical' | 'warning' | 'info'

interface IntelCardProps {
  severity: IntelSeverity
  title:    ReactNode
  detail?:  ReactNode
  icon?:    'concentration' | 'loss' | 'sector' | 'info'
  className?: string
}

const ICONS = {
  concentration: ShieldAlert,
  loss:          TrendingDown,
  sector:        AlertTriangle,
  info:          Info,
} as const

/**
 * Inline intelligence alert.
 * Only renders when triggered — no "everything is fine" placeholder.
 */
export function IntelCard({
  severity,
  title,
  detail,
  icon = 'info',
  className = '',
}: IntelCardProps) {
  const Icon = ICONS[icon]
  return (
    <div className={`intel-card intel-card--${severity} ${className}`}>
      <span className="intel-card-icon">
        <Icon size={14} />
      </span>
      <div className="intel-card-body">
        <div className="intel-card-title">{title}</div>
        {detail && <div className="intel-card-detail">{detail}</div>}
      </div>
    </div>
  )
}
