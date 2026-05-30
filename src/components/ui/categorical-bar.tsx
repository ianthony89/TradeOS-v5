'use client'

import type { DonutSlice } from './donut-chart'
import { fmt } from '@/lib/utils/format'
import { useChartTooltip, ChartTooltip } from './chart-tooltip'

/**
 * Ranked horizontal bars — one per sector, sorted high→low.
 * The most legible allocation view. Hover for sector · $ · %.
 */
export function CategoricalBar({ slices }: { slices: DonutSlice[] }) {
  const { tip, show, move, hide } = useChartTooltip()
  const data = [...slices].filter(s => s.pct > 0).sort((a, b) => b.pct - a.pct)
  if (!data.length) return null
  const max = data[0].pct

  return (
    <>
      <div className="catbar">
        {data.map(s => (
          <div
            key={s.name}
            className="catbar-row"
            onMouseEnter={e => show(e, s.name, `${fmt.money(s.value, 'USD')} · ${fmt.pct(s.pct, 1)}`)}
            onMouseMove={move}
            onMouseLeave={hide}
          >
            <span className="catbar-name">{s.name}</span>
            <div className="catbar-track">
              <div className="catbar-fill" style={{ width: `${(s.pct / max) * 100}%`, background: s.color }} />
            </div>
            <span className="catbar-val text-tabular">{fmt.pct(s.pct, 1)}</span>
          </div>
        ))}
      </div>
      <ChartTooltip tip={tip} />
    </>
  )
}
