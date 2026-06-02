import type { ReactNode } from 'react'
import Link from 'next/link'
import { AlertTriangle, Info, TrendingDown, ShieldAlert, CalendarClock, Lightbulb, Target, Eye, ChevronRight } from 'lucide-react'

export type IntelSeverity = 'critical' | 'warning' | 'info'

interface IntelCardProps {
  severity: IntelSeverity
  title:    ReactNode
  detail?:  ReactNode
  icon?:    'concentration' | 'loss' | 'sector' | 'info' | 'review' | 'thesis' | 'target' | 'watch'
  /** When set, the whole card becomes a deep-link (Dashboard → Position Hub / Watchlist). */
  href?:    string
  className?: string
}

const ICONS = {
  concentration: ShieldAlert,
  loss:          TrendingDown,
  sector:        AlertTriangle,
  info:          Info,
  review:        CalendarClock,
  thesis:        Lightbulb,
  target:        Target,
  watch:         Eye,
} as const

/**
 * Inline intelligence alert. Only renders when triggered — no "all clear"
 * placeholder. With `href`, it renders as a clickable deep-link.
 */
export function IntelCard({
  severity,
  title,
  detail,
  icon = 'info',
  href,
  className = '',
}: IntelCardProps) {
  const Icon = ICONS[icon]
  const cls = `intel-card intel-card--${severity}${href ? ' intel-card--link' : ''} ${className}`
  const inner = (
    <>
      <span className="intel-card-icon">
        <Icon size={14} />
      </span>
      <div className="intel-card-body">
        <div className="intel-card-title">{title}</div>
        {detail && <div className="intel-card-detail">{detail}</div>}
      </div>
      {href && <ChevronRight size={15} className="intel-card-go" />}
    </>
  )
  return href
    ? <Link href={href} className={cls}>{inner}</Link>
    : <div className={cls}>{inner}</div>
}
