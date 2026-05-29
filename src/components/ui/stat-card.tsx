import type { ReactNode } from 'react'

interface StatCardProps {
  label:    string
  value:    ReactNode
  sub?:     ReactNode
  tone?:    'neutral' | 'positive' | 'negative'
  className?: string
}

/**
 * Premium stat card.
 * label (uppercase muted) → value (28px tabular) → optional sub line.
 */
export function StatCard({ label, value, sub, tone = 'neutral', className = '' }: StatCardProps) {
  const valueClass =
    tone === 'positive' ? 'stat-card-value stat-card-value--positive'
    : tone === 'negative' ? 'stat-card-value stat-card-value--negative'
    : 'stat-card-value'
  return (
    <div className={`stat-card ${className}`}>
      <span className="stat-card-label">{label}</span>
      <span className={valueClass}>{value}</span>
      {sub && <div className="stat-card-sub">{sub}</div>}
    </div>
  )
}
