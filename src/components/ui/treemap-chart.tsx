'use client'

import type { DonutSlice } from './donut-chart'
import { fmt } from '@/lib/utils/format'
import { useChartTooltip, ChartTooltip } from './chart-tooltip'

/** A holding within a sector (used by the treemap to list a sector's names). */
export interface StarItem {
  symbol: string
  sector: string
  weight: number
  color:  string
}

/**
 * Sector treemap. Block size ∝ market value. Largest sector fills the left
 * column; the rest stack on the right. Big cells also list the sector's top
 * holdings when there's room. Hover brightens with a tooltip.
 */
export function TreemapChart({ slices, stars = [] }: { slices: DonutSlice[]; stars?: StarItem[] }) {
  const { tip, show, move, hide } = useChartTooltip()
  const data = [...slices].filter(s => s.pct > 0).sort((a, b) => b.value - a.value)
  if (!data.length) return null

  // Holdings grouped by (localized) sector label, top weight first.
  const bySector = new Map<string, StarItem[]>()
  for (const s of stars) {
    const arr = bySector.get(s.sector) ?? []
    arr.push(s); bySector.set(s.sector, arr)
  }

  const [big, ...rest] = data
  const restTotal = rest.reduce((s, x) => s + x.pct, 0)

  const cell = (s: DonutSlice) => {
    const holdings = (bySector.get(s.name) ?? []).sort((a, b) => b.weight - a.weight)
    const showHoldings = s.pct >= 18 && holdings.length > 0
    return (
      <div
        key={s.name}
        className="tm-cell"
        style={{ flex: s.pct, background: s.color }}
        onMouseEnter={e => show(e, s.name, `${fmt.money(s.value, 'USD')} · ${fmt.pct(s.pct, 1)}`)}
        onMouseMove={move}
        onMouseLeave={hide}
      >
        <div className="tm-holdings">
          {showHoldings && holdings.slice(0, 6).map(h => (
            <span key={h.symbol} className="tm-chip">{h.symbol}</span>
          ))}
        </div>
        <div className="tm-cell-label">
          <span className="tm-name">{s.name}</span>
          <span className="tm-pct">{fmt.pct(s.pct, 1)}</span>
        </div>
      </div>
    )
  }

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
