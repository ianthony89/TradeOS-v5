'use client'

import { fmt } from '@/lib/utils/format'

export interface RiskBar {
  name:     string
  pct:      number     // 0–100
  value:    number     // money in USD
  color:    string
}

interface RiskByStrategyProps {
  bars:       RiskBar[]
  className?: string
}

/**
 * Horizontal bar list — one row per strategy class (CORE / TACTICAL / SPECULATIVE).
 * Per row: label / bar / pct / $ value.
 */
export function RiskByStrategy({ bars, className = '' }: RiskByStrategyProps) {
  if (!bars.length) {
    return (
      <div className="text-tertiary" style={{ fontSize: 12 }}>
        No strategy data yet.
      </div>
    )
  }
  return (
    <div className={`risk-bars ${className}`}>
      {bars.map(b => (
        <div key={b.name} className="risk-bar-row">
          <span className="risk-bar-label">{b.name}</span>
          <div className="risk-bar-track">
            <div
              className="risk-bar-fill"
              style={{ width: `${b.pct}%`, background: b.color }}
            />
          </div>
          <div className="risk-bar-val">
            <div className="risk-bar-pct text-mono text-tabular">{fmt.pct(b.pct, 1)}</div>
            <div className="risk-bar-money text-mono text-tabular">{fmt.compact(b.value, 'USD')}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
