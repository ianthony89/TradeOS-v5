'use client'

import { fmt } from '@/lib/utils/format'
import { useChartTooltip, ChartTooltip } from './chart-tooltip'

export interface RiskBar {
  name:     string
  pct:      number     // 0–100
  value:    number     // money in USD
  color:    string
  hint?:    string     // plain-language definition, shown on hover
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
  const { tip, show, move, hide } = useChartTooltip()
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
        <div
          key={b.name}
          className={`risk-bar-row${b.hint ? ' risk-bar-row--interactive' : ''}`}
          onMouseEnter={b.hint ? e => show(e, b.name, b.hint!, 'prose') : undefined}
          onMouseMove={b.hint ? move : undefined}
          onMouseLeave={b.hint ? hide : undefined}
        >
          <span className="risk-bar-label">{b.name}</span>
          <div className="risk-bar-track">
            <div
              className="risk-bar-fill"
              style={{ width: `${b.pct}%`, background: b.color, ['--rg-glow' as string]: b.color }}
            />
          </div>
          <div className="risk-bar-val">
            <div className="risk-bar-pct text-mono text-tabular">{fmt.pct(b.pct, 1)}</div>
            <div className="risk-bar-money text-mono text-tabular">{fmt.compact(b.value, 'USD')}</div>
          </div>
        </div>
      ))}
      <ChartTooltip tip={tip} />
    </div>
  )
}
