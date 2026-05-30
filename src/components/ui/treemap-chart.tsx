'use client'

import type { DonutSlice } from './donut-chart'
import { fmt } from '@/lib/utils/format'
import { useChartTooltip, ChartTooltip } from './chart-tooltip'

/**
 * Sector treemap. Block size ∝ market value. Largest sector fills the left
 * column; the rest stack on the right. Calm by default, brightens on hover
 * with a tooltip (sector · $ · %).
 */
export function TreemapChart({ slices }: { slices: DonutSlice[] }) {
  const { tip, show, move, hide } = useChartTooltip()
  const data = [...slices].filter(s => s.pct > 0).sort((a, b) => b.value - a.value)
  if (!data.length) return null

  const [big, ...rest] = data
  const restTotal = rest.reduce((s, x) => s + x.pct, 0)

  const cell = (s: DonutSlice) => (
    <div
      key={s.name}
      className="tm-cell"
      style={{ flex: s.pct, background: s.color }}
      onMouseEnter={e => show(e, s.name, `${fmt.money(s.value, 'USD')} · ${fmt.pct(s.pct, 1)}`)}
      onMouseMove={move}
      onMouseLeave={hide}
    >
      <span className="tm-name">{s.name}</span>
      <span className="tm-pct">{fmt.pct(s.pct, 1)}</span>
    </div>
  )

  return (
    <>
      <div className="tm-wrap">
        <div className="tm-col" style={{ flex: big.pct }}>{cell(big)}</div>
        {rest.length > 0 && (
          <div className="tm-col" style={{ flex: restTotal }}>
            {rest.map(cell)}
          </div>
        )}
      </div>
      <ChartTooltip tip={tip} />
    </>
  )
}
