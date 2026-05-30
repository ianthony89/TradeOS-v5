'use client'

import { fmt } from '@/lib/utils/format'
import { useChartTooltip, ChartTooltip } from './chart-tooltip'

export interface StarItem {
  symbol:  string
  sector:  string
  weight:  number   // portfolio weight %
  color:   string   // sector color
}

const W = 520
const H = 300

/** Deterministic pseudo-random in [0,1) — keeps SSR and client identical. */
function rng(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

/**
 * Portfolio constellation. Holdings are stars grouped by sector into clusters,
 * star size ∝ weight, same-sector stars linked into a constellation. Pure
 * overview/“cover” visual — decorative, not a daily-driver metric.
 */
export function Constellation({ items }: { items: StarItem[] }) {
  const { tip, show, move, hide } = useChartTooltip()

  // Group by sector, preserving first-seen colour
  const bySector = new Map<string, { color: string; stars: StarItem[] }>()
  for (const it of items) {
    if (!bySector.has(it.sector)) bySector.set(it.sector, { color: it.color, stars: [] })
    bySector.get(it.sector)!.stars.push(it)
  }
  const sectors = [...bySector.entries()]
  const n = sectors.length || 1

  // Cluster centres spread around the canvas
  const cx = W / 2, cy = H / 2
  const clusters = sectors.map(([name, grp], i) => {
    const a = (-Math.PI / 2) + (i / n) * Math.PI * 2
    const spread = Math.min(W, H) * 0.30
    return { name, grp, x: cx + Math.cos(a) * spread, y: cy + Math.sin(a) * spread * 0.78 }
  })

  // Background star field (deterministic)
  const bg = Array.from({ length: 46 }, (_, i) => ({
    x: rng(i + 1) * W,
    y: rng(i + 100) * H,
    r: rng(i + 200) * 1.1 + 0.3,
    o: rng(i + 300) * 0.5 + 0.1,
  }))

  return (
    <div className="constel">
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
        {bg.map((s, i) => (
          <circle key={`bg-${i}`} cx={s.x} cy={s.y} r={s.r} fill="#ffffff" fillOpacity={s.o} />
        ))}

        {clusters.map(c => {
          const m = c.grp.stars.length
          const pos = c.grp.stars.map((st, j) => {
            const a = (j / Math.max(1, m)) * Math.PI * 2 + rng(j + 7)
            const rad = m > 1 ? 30 + rng(j + 11) * 14 : 0
            return { st, x: c.x + Math.cos(a) * rad, y: c.y + Math.sin(a) * rad }
          })
          return (
            <g key={c.name}>
              {pos.map((p, j) =>
                pos.slice(j + 1).map((q, k) => (
                  <line
                    key={`l-${j}-${k}`}
                    x1={p.x} y1={p.y} x2={q.x} y2={q.y}
                    stroke={c.grp.color} strokeOpacity={0.32} strokeWidth={0.8}
                  />
                )),
              )}
              {pos.map(p => {
                const r = 3.5 + Math.sqrt(p.st.weight) * 1.5
                return (
                  <g
                    key={p.st.symbol}
                    onMouseEnter={e => show(e, p.st.symbol, `${p.st.sector} · ${fmt.pct(p.st.weight, 1)}`)}
                    onMouseMove={move}
                    onMouseLeave={hide}
                    style={{ cursor: 'default' }}
                  >
                    <circle cx={p.x} cy={p.y} r={r + 4} fill={c.grp.color} fillOpacity={0.16} />
                    <circle cx={p.x} cy={p.y} r={r} fill="#ffffff" />
                    <circle cx={p.x} cy={p.y} r={r * 0.6} fill={c.grp.color} />
                  </g>
                )
              })}
            </g>
          )
        })}
      </svg>
      <ChartTooltip tip={tip} />
    </div>
  )
}
