'use client'

import { fmt } from '@/lib/utils/format'

export interface SectorSlice {
  name:    string
  value:   number    // absolute (USD)
  pct:     number    // 0–100
  color:   string    // var(--sector-…)
}

interface SectorBarProps {
  slices:    SectorSlice[]
  className?: string
}

/**
 * Horizontal stacked allocation bar + legend.
 * Calm visualization — no animation, no glow, just clean segments.
 */
export function SectorBar({ slices, className = '' }: SectorBarProps) {
  if (!slices.length) return null
  return (
    <div className={`sector-bar-wrap ${className}`}>
      <div className="sector-bar">
        {slices.map(s => (
          <div
            key={s.name}
            className="sector-bar-seg"
            style={{ width: `${s.pct}%`, background: s.color }}
            title={`${s.name}  ${fmt.pct(s.pct, 1)}`}
          />
        ))}
      </div>
      <div className="sector-legend">
        {slices.map(s => (
          <div key={s.name} className="sector-legend-item">
            <span className="sector-legend-dot" style={{ background: s.color }} />
            <span className="sector-legend-name">{s.name}</span>
            <span className="sector-legend-pct text-tabular">{fmt.pct(s.pct, 1)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
