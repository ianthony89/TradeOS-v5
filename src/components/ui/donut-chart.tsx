'use client'

import { useState } from 'react'
import { fmt } from '@/lib/utils/format'
import { useChartTooltip, ChartTooltip } from './chart-tooltip'

export interface DonutSlice {
  name:   string
  value:  number
  pct:    number     // 0–100
  color:  string     // CSS color or var(--…)
}

interface DonutChartProps {
  slices:        DonutSlice[]
  centerValue?:  string
  centerLabel?:  string
  size?:         number
  thickness?:    number
  className?:    string
}

/**
 * SVG donut chart with hover-glow on segments.
 * Calm by default — no animation, no decoration. Hovering a slice adds
 * a soft drop-shadow in the slice's own color and lifts it slightly.
 */
export function DonutChart({
  slices,
  centerValue,
  centerLabel,
  size      = 220,
  thickness = 30,
  className = '',
}: DonutChartProps) {
  const [hover, setHover] = useState<string | null>(null)
  const { tip, show, move, hide } = useChartTooltip()

  const cx = size / 2
  const cy = size / 2
  const outer = size / 2 - 4
  const inner = outer - thickness

  // Build the arcs from prefix-summed percentages so we don't
  // need to mutate any state during render. Starts at 12 o'clock.
  const filtered = slices.filter(s => s.pct > 0)
  const cumPcts  = filtered.reduce<number[]>(
    (acc, s) => [...acc, (acc[acc.length - 1] ?? 0) + s.pct],
    [0],
  )
  const arcs = filtered.map((s, i) => {
    const a0 = -Math.PI / 2 + (cumPcts[i]     / 100) * 2 * Math.PI
    const a1 = -Math.PI / 2 + (cumPcts[i + 1] / 100) * 2 * Math.PI
    return {
      name:  s.name,
      color: s.color,
      pct:   s.pct,
      value: s.value,
      d:     arcPath(cx, cy, inner, outer, a0, a1),
    }
  })

  return (
    <div className={`donut-wrap ${className}`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {arcs.map(a => {
          const isHover = hover === a.name
          return (
            <path
              key={a.name}
              d={a.d}
              fill={a.color}
              className="donut-slice"
              data-hover={isHover ? 'true' : 'false'}
              style={{
                ['--slice-color' as string]: a.color,
              }}
              onMouseEnter={e => { setHover(a.name); show(e, a.name, `${fmt.money(a.value, 'USD')} · ${fmt.pct(a.pct, 1)}`) }}
              onMouseMove={move}
              onMouseLeave={() => { setHover(null); hide() }}
            />
          )
        })}

        {(centerValue || centerLabel) && (
          <g pointerEvents="none">
            {centerValue && (
              <text
                x={cx}
                y={cy - 4}
                textAnchor="middle"
                dominantBaseline="middle"
                className="donut-center-value"
              >
                {centerValue}
              </text>
            )}
            {centerLabel && (
              <text
                x={cx}
                y={cy + 16}
                textAnchor="middle"
                dominantBaseline="middle"
                className="donut-center-label"
              >
                {centerLabel}
              </text>
            )}
          </g>
        )}
      </svg>
      <ChartTooltip tip={tip} />
    </div>
  )
}

/** Build a ring-sector path from inner radius r1 to outer radius r2. */
function arcPath(
  cx: number, cy: number,
  r1: number, r2: number,
  a0: number, a1: number,
): string {
  const sweep = a1 - a0
  const large = sweep > Math.PI ? 1 : 0

  const x1 = cx + r2 * Math.cos(a0)
  const y1 = cy + r2 * Math.sin(a0)
  const x2 = cx + r2 * Math.cos(a1)
  const y2 = cy + r2 * Math.sin(a1)
  const x3 = cx + r1 * Math.cos(a1)
  const y3 = cy + r1 * Math.sin(a1)
  const x4 = cx + r1 * Math.cos(a0)
  const y4 = cy + r1 * Math.sin(a0)

  return [
    `M ${x1.toFixed(2)} ${y1.toFixed(2)}`,
    `A ${r2} ${r2} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`,
    `L ${x3.toFixed(2)} ${y3.toFixed(2)}`,
    `A ${r1} ${r1} 0 ${large} 0 ${x4.toFixed(2)} ${y4.toFixed(2)}`,
    'Z',
  ].join(' ')
}
