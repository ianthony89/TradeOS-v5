import type { ReactNode } from 'react'

interface StatCardProps {
  label:    string
  value:    ReactNode
  sub?:     ReactNode
  icon?:    ReactNode
  tone?:    'neutral' | 'positive' | 'negative'
  className?: string
}

/**
 * Premium stat card.
 * label (uppercase muted) + optional icon → value (tabular) → optional sub.
 */
export function StatCard({ label, value, sub, icon, tone = 'neutral', className = '' }: StatCardProps) {
  const valueClass =
    tone === 'positive' ? 'stat-card-value stat-card-value--positive'
    : tone === 'negative' ? 'stat-card-value stat-card-value--negative'
    : 'stat-card-value'
  return (
    <div className={`stat-card ${className}`}>
      <div className="stat-card-top">
        <span className="stat-card-label">{label}</span>
        {icon && <span className="stat-card-icon">{icon}</span>}
      </div>
      <span className={valueClass}>{value}</span>
      {sub && <div className="stat-card-sub">{sub}</div>}
    </div>
  )
}
