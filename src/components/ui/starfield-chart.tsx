'use client'

import { fmt } from '@/lib/utils/format'
import { useChartTooltip, ChartTooltip } from './chart-tooltip'

export interface StarItem {
  symbol: string
  sector: string
  weight: number   // portfolio weight %
  color:  string   // sector color
  pl:     number   // P/L % (drives the glow: green up / red down)
}

const W = 480
const H = 240
const GA = Math.PI * (3 - Math.sqrt(5))   // golden angle — even, organic spiral
const SQUASH = 0.62                        // flatten into a wide galactic disk

/** Stable hash of a string → positive int. */
function hashStr(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}
function rng(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453
  return x - Math.floor(x)
}
/** Glow colour from P/L — winners burn green, losers fade red, flat = pale blue. */
function plGlow(pl: number): string {
  if (pl > 1)  return '#10b981'
  if (pl < -1) return '#f43f5e'
  return '#9bb4e0'
}

/**
 * Portfolio Galaxy — every holding is a star on a golden-angle spiral
 * (deterministic, always balanced). Size = weight, core colour = sector,
 * and the glow burns green/red by P/L so the whole galaxy lights up with
 * how the book is doing. Stars twinkle faster the more they've moved.
 */
export function StarfieldChart({ stars }: { stars: StarItem[] }) {
  const { tip, show, move, hide } = useChartTooltip()
  if (!stars.length) return null

  const cx = W / 2, cy = H / 2
  const data = [...stars].sort((a, b) => b.weight - a.weight)
  const spacing = Math.min(40, 150 / Math.sqrt(Math.max(1, data.length)))

  const pos = data.map((st, i) => {
    const r  = 12 + spacing * Math.sqrt(i)
    const th = i * GA
    const R  = Math.min(16, 2.2 + Math.pow(st.weight, 0.62) * 1.7)
    const seed = hashStr(st.symbol)
    return {
      st, R,
      x: cx + Math.cos(th) * r,
      y: cy + Math.sin(th) * r * SQUASH,
      glow: plGlow(st.pl),
      glowO: 0.3 + Math.min(Math.abs(st.pl) / 45, 1) * 0.5,
      twk: Math.max(1.4, 5.4 - Math.min(Math.abs(st.pl), 90) / 20),   // faster when it moves more
      fx: (rng(seed + 5) - 0.5) * 8,
      fy: (rng(seed + 6) - 0.5) * 8,
      fdur: 6 + rng(seed + 8) * 6,
      fdel: rng(seed + 9) * 4,
      flare: i === 0 && R > 9,
    }
  })

  // Background star field (deterministic)
  const bg = Array.from({ length: 90 }, (_, i) => ({
    x: rng(i + 1) * W, y: rng(i + 41) * H,
    r: rng(i + 83) ** 2 * 1.6 + 0.3, o: rng(i + 127) * 0.5 + 0.1, tw: i % 3 === 0,
  }))

  return (
    <div className="starfield">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice">
        <defs>
          <filter id="sf-glow" x="-90%" y="-90%" width="280%" height="280%">
            <feGaussianBlur stdDeviation="2.6" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <radialGradient id="sf-core" cx="50%" cy="50%" r="50%">
            <stop offset="0%"  stopColor="#ffffff" stopOpacity="0.5" />
            <stop offset="40%" stopColor="#9bb4e0" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#9bb4e0" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="sf-neb-a" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#3b5bd9" stopOpacity="0.20" />
            <stop offset="100%" stopColor="#3b5bd9" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="sf-neb-b" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#7c4dff" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#7c4dff" stopOpacity="0" />
          </radialGradient>
        </defs>

        <ellipse cx={150} cy={100} rx={220} ry={150} fill="url(#sf-neb-a)" />
        <ellipse cx={360} cy={170} rx={200} ry={140} fill="url(#sf-neb-b)" />

        {bg.map((s, i) => (
          <circle
            key={`bg-${i}`} cx={s.x} cy={s.y} r={s.r} fill="#fff" fillOpacity={s.o}
            className={s.tw ? 'sf-twinkle' : undefined}
            style={s.tw ? { animationDelay: `${(i % 7) * 0.45}s` } : undefined}
          />
        ))}

        {/* Glowing galactic core */}
        <circle cx={cx} cy={cy} r={30} fill="url(#sf-core)" />

        {/* Glow halos coloured by P/L */}
        <g filter="url(#sf-glow)">
          {pos.map(p => (
            <circle key={`h-${p.st.symbol}`} cx={p.x} cy={p.y} r={p.R * 1.5} fill={p.glow} fillOpacity={p.glowO} />
          ))}
        </g>

        {/* Stars — sector-coloured core, drifting + twinkling */}
        {pos.map(p => (
          <g
            key={p.st.symbol}
            className="sf-float"
            style={{
              ['--dx' as string]: `${p.fx}px`,
              ['--dy' as string]: `${p.fy}px`,
              animationDuration: `${p.fdur}s`,
              animationDelay: `${p.fdel}s`,
            }}
          >
            <g
              className="sf-star"
              onMouseEnter={e => show(e, p.st.sector, `${p.st.symbol} · ${fmt.pct(p.st.weight, 1)} · ${fmt.pctSigned(p.st.pl, 1)}`)}
              onMouseMove={move}
              onMouseLeave={hide}
            >
              {p.flare && (
                <g stroke="#fff" strokeOpacity={0.4} strokeWidth={0.7} strokeLinecap="round">
                  <line x1={p.x - p.R * 2.6} y1={p.y} x2={p.x + p.R * 2.6} y2={p.y} />
                  <line x1={p.x} y1={p.y - p.R * 2.6} x2={p.x} y2={p.y + p.R * 2.6} />
                </g>
              )}
              <circle
                className="sf-orb" style={{ animationDuration: `${p.twk}s`, animationDelay: `${p.fdel}s` }}
                cx={p.x} cy={p.y} r={p.R} fill={p.st.color}
              />
              <circle cx={p.x} cy={p.y} r={Math.max(1.2, p.R * 0.38)} fill="#fff" />
            </g>
          </g>
        ))}
      </svg>
      <ChartTooltip tip={tip} />
    </div>
  )
}
