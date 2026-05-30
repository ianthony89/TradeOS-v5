'use client'

import { fmt } from '@/lib/utils/format'
import { useChartTooltip, ChartTooltip } from './chart-tooltip'

export interface StarItem {
  symbol: string
  sector: string
  weight: number   // portfolio weight %
  color:  string   // sector color
}

const W = 480
const H = 300

/* Deterministic cluster slots (fractions of W×H), ordered by sector weight.
   Biggest two sit apart up top; the rest fan out below, so a mid sector
   (e.g. Healthcare) lands under the big ones rather than in a corner. */
const SLOTS: [number, number][] = [
  [0.32, 0.42], [0.62, 0.40], [0.66, 0.70], [0.34, 0.70],
  [0.49, 0.82], [0.48, 0.20], [0.84, 0.52], [0.16, 0.52],
]

/** Stable hash of a string → positive int (for per-star deterministic scatter). */
function hashStr(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}
/** Deterministic pseudo-random in [0,1). */
function rng(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453
  return x - Math.floor(x)
}

/**
 * Starfield — holdings as soft glowing stars, clustered by sector, size ∝
 * weight. Positions inside a cluster are scattered organically (seeded by
 * symbol, so no two clusters look alike). A nebula + a field of dim/bright
 * twinkling stars give the night-sky feel; hovering a star brightens + pulses.
 */
export function StarfieldChart({ stars }: { stars: StarItem[] }) {
  const { tip, show, move, hide } = useChartTooltip()
  if (!stars.length) return null

  const bySector = new Map<string, { color: string; weight: number; items: StarItem[] }>()
  for (const s of stars) {
    if (!bySector.has(s.sector)) bySector.set(s.sector, { color: s.color, weight: 0, items: [] })
    const g = bySector.get(s.sector)!
    g.items.push(s); g.weight += s.weight
  }
  const sectors = [...bySector.entries()].sort((a, b) => b[1].weight - a[1].weight)

  // Background star field — varied size + brightness, ~1/3 twinkle
  const bg = Array.from({ length: 96 }, (_, i) => ({
    x: rng(i + 1) * W,
    y: rng(i + 41) * H,
    r: rng(i + 83) ** 2 * 1.7 + 0.3,
    o: rng(i + 127) * 0.55 + 0.1,
    tw: i % 3 === 0,
  }))

  return (
    <div className="starfield">
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
        <defs>
          <filter id="sf-glow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="3.6" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <radialGradient id="sf-neb-a" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#3b5bd9" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#3b5bd9" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="sf-neb-b" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#7c4dff" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#7c4dff" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Nebula clouds */}
        <ellipse cx={150} cy={110} rx={210} ry={150} fill="url(#sf-neb-a)" />
        <ellipse cx={360} cy={210} rx={190} ry={140} fill="url(#sf-neb-b)" />

        {/* Background stars */}
        {bg.map((s, i) => (
          <circle
            key={`bg-${i}`} cx={s.x} cy={s.y} r={s.r} fill="#fff" fillOpacity={s.o}
            className={s.tw ? 'sf-twinkle' : undefined}
            style={s.tw ? { animationDelay: `${(i % 7) * 0.45}s` } : undefined}
          />
        ))}

        {sectors.map(([name, grp], i) => {
          const slot = SLOTS[i] ?? [0.5 + Math.cos(i) * 0.3, 0.5 + Math.sin(i) * 0.3]
          const cxs = slot[0] * W + (rng(i + 900) - 0.5) * 16
          const cys = slot[1] * H + (rng(i + 950) - 0.5) * 16
          const m = grp.items.length
          const maxW = Math.max(...grp.items.map(s => s.weight))

          const pos = grp.items.map(st => {
            const seed = hashStr(st.symbol)
            const ang  = rng(seed) * Math.PI * 2
            const rad  = m > 1 ? 10 + rng(seed * 3 + 1) * 38 : 0
            const R    = 3.4 + Math.sqrt(st.weight) * 1.8
            return { st, x: cxs + Math.cos(ang) * rad, y: cys + Math.sin(ang) * rad, R, flare: st.weight === maxW && R > 7 }
          })

          return (
            <g key={name}>
              {pos.map((p, j) =>
                pos.slice(j + 1).map((q, k) => (
                  <line
                    key={`l-${j}-${k}`} x1={p.x} y1={p.y} x2={q.x} y2={q.y}
                    stroke={grp.color} strokeOpacity={0.18} strokeWidth={0.7}
                  />
                )),
              )}
              {/* Soft bloom */}
              <g filter="url(#sf-glow)">
                {pos.map(p => (
                  <circle key={`h-${p.st.symbol}`} cx={p.x} cy={p.y} r={p.R + 2.5} fill={grp.color} fillOpacity={0.5} />
                ))}
              </g>
              {/* Star cores */}
              {pos.map((p, j) => (
                <g
                  key={p.st.symbol}
                  className="sf-star"
                  onMouseEnter={e => show(e, p.st.sector, `${p.st.symbol} · ${fmt.pct(p.st.weight, 1)}`)}
                  onMouseMove={move}
                  onMouseLeave={hide}
                >
                  {p.flare && (
                    <g stroke="#fff" strokeOpacity={0.4} strokeWidth={0.7} strokeLinecap="round">
                      <line x1={p.x - p.R * 3} y1={p.y} x2={p.x + p.R * 3} y2={p.y} />
                      <line x1={p.x} y1={p.y - p.R * 3} x2={p.x} y2={p.y + p.R * 3} />
                    </g>
                  )}
                  <circle
                    className="sf-orb" style={{ animationDelay: `${(j % 5) * 0.8}s` }}
                    cx={p.x} cy={p.y} r={p.R} fill={grp.color}
                  />
                  <circle cx={p.x} cy={p.y} r={Math.max(1.3, p.R * 0.42)} fill="#fff" />
                </g>
              ))}
            </g>
          )
        })}
      </svg>
      <ChartTooltip tip={tip} />
    </div>
  )
}
