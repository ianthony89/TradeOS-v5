'use client'

import { fmt } from '@/lib/utils/format'
import type { DonutSlice } from './donut-chart'
import type { StarItem }   from './treemap-chart'
import { useChartTooltip, ChartTooltip } from './chart-tooltip'

const SIZE = 220
const CX = SIZE / 2, CY = SIZE / 2
const IN1 = 42, IN2 = 70    // inner ring (sectors)
const OUT1 = 73, OUT2 = 100 // outer ring (holdings)

/** Ring-sector path; f0/f1 are fractions of the full circle (0–1). */
function arc(r1: number, r2: number, f0: number, f1: number): string {
  const a0 = (-90 + f0 * 360) * Math.PI / 180
  const a1 = (-90 + f1 * 360) * Math.PI / 180
  const lg = (f1 - f0) > 0.5 ? 1 : 0
  const x1 = CX + r2 * Math.cos(a0), y1 = CY + r2 * Math.sin(a0)
  const x2 = CX + r2 * Math.cos(a1), y2 = CY + r2 * Math.sin(a1)
  const x3 = CX + r1 * Math.cos(a1), y3 = CY + r1 * Math.sin(a1)
  const x4 = CX + r1 * Math.cos(a0), y4 = CY + r1 * Math.sin(a0)
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r2} ${r2} 0 ${lg} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} L ${x3.toFixed(2)} ${y3.toFixed(2)} A ${r1} ${r1} 0 ${lg} 0 ${x4.toFixed(2)} ${y4.toFixed(2)} Z`
}
/** Blend a hex colour toward white (for distinguishing holdings in a sector). */
function lighten(hex: string, f: number): string {
  const n = parseInt(hex.replace('#', ''), 16)
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255
  const m = (c: number) => Math.round(c + (255 - c) * f)
  return `rgb(${m(r)}, ${m(g)}, ${m(b)})`
}

/**
 * Sunburst — inner ring is the sector split, outer ring breaks each sector
 * into its holdings. A richer donut: one glance shows sector tilt and which
 * names fill each wedge. Hover any segment for the detail.
 */
export function SunburstChart({
  slices, stars, centerValue, centerLabel,
}: {
  slices:       DonutSlice[]
  stars:        StarItem[]
  centerValue?: string
  centerLabel?: string
}) {
  const { tip, show, move, hide } = useChartTooltip()
  const data = [...slices].filter(s => s.pct > 0).sort((a, b) => b.pct - a.pct)
  if (!data.length) return null

  const bySector = new Map<string, StarItem[]>()
  for (const h of stars) { const a = bySector.get(h.sector) ?? []; a.push(h); bySector.set(h.sector, a) }
  const total = data.reduce((s, x) => s + x.pct, 0) || 100

  type Seg = { key: string; d: string; color: string; name: string; detail: string }
  const inner: Seg[] = []
  const outer: Seg[] = []
  let cum = 0
  for (const s of data) {
    const f0 = cum / total, f1 = (cum + s.pct) / total
    inner.push({ key: `i-${s.name}`, d: arc(IN1, IN2, f0, f1), color: s.color, name: s.name, detail: `${fmt.money(s.value, 'USD')} · ${fmt.pct(s.pct, 1)}` })
    const hs = (bySector.get(s.name) ?? []).slice().sort((a, b) => b.weight - a.weight)
    let hc = cum
    hs.forEach((h, i) => {
      const hf0 = hc / total, hf1 = (hc + h.weight) / total
      hc += h.weight
      outer.push({ key: `o-${h.symbol}`, d: arc(OUT1, OUT2, hf0, hf1), color: lighten(s.color, 0.1 + (i % 3) * 0.16), name: h.symbol, detail: `${fmt.pct(h.weight, 1)} of portfolio` })
    })
    cum += s.pct
  }

  return (
    <div className="donut-wrap">
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        {[...inner, ...outer].map(seg => (
          <path
            key={seg.key} d={seg.d} fill={seg.color} stroke="var(--bg-base)" strokeWidth={1}
            className="sun-seg"
            onMouseEnter={e => show(e, seg.name, seg.detail)}
            onMouseMove={move}
            onMouseLeave={hide}
          />
        ))}
        <g pointerEvents="none">
          {centerValue && <text x={CX} y={CY - 4} textAnchor="middle" dominantBaseline="middle" className="donut-center-value">{centerValue}</text>}
          {centerLabel && <text x={CX} y={CY + 16} textAnchor="middle" dominantBaseline="middle" className="donut-center-label">{centerLabel}</text>}
        </g>
      </svg>
      <ChartTooltip tip={tip} />
    </div>
  )
}
