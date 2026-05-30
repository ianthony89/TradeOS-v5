'use client'

import { useState } from 'react'
import { fmt } from '@/lib/utils/format'
import { RotateCcw } from 'lucide-react'
import { useChartTooltip, ChartTooltip } from './chart-tooltip'

export interface RaceItem {
  symbol:   string
  value:    number   // USD-equivalent market value
  color?:   string
}

/**
 * Animated bar race of the largest positions. Bars grow on mount (CSS
 * keyframes, scaleX 0→1) and replay by re-keying the list — no setState in
 * an effect, so it stays React-Compiler clean.
 */
export function BarRace({ items, top = 8 }: { items: RaceItem[]; top?: number }) {
  const [runId, setRunId] = useState(0)
  const { tip, show, move, hide } = useChartTooltip()

  const data = [...items].sort((a, b) => b.value - a.value).slice(0, top)
  const max = data[0]?.value ?? 1

  return (
    <div className="race">
      <div className="race-head">
        <span className="race-hint">Largest positions · grows on play</span>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRunId(n => n + 1)}>
          <RotateCcw size={13} /> Replay
        </button>
      </div>

      <div className="race-rows" key={runId}>
        {data.map((d, i) => (
          <div
            key={d.symbol}
            className="race-row"
            onMouseEnter={e => show(e, d.symbol, fmt.money(d.value, 'USD'))}
            onMouseMove={move}
            onMouseLeave={hide}
          >
            <span className="race-sym">{d.symbol}</span>
            <div className="race-track">
              <div
                className="race-fill"
                style={{
                  width: `${(d.value / max) * 100}%`,
                  background: d.color ?? 'var(--accent)',
                  animationDelay: `${i * 0.08}s`,
                }}
              />
            </div>
            <span className="race-val text-tabular">{fmt.compact(d.value, 'USD')}</span>
          </div>
        ))}
      </div>
      <ChartTooltip tip={tip} />
    </div>
  )
}
