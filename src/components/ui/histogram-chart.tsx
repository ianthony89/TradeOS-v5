'use client'

import { useChartTooltip, ChartTooltip } from './chart-tooltip'

interface Bucket { label: string; color: string; test: (p: number) => boolean }

const BUCKETS: Bucket[] = [
  { label: '< -50%',    color: '#f43f5e', test: p => p < -50 },
  { label: '-50…-25%',  color: '#fb7185', test: p => p >= -50 && p < -25 },
  { label: '-25…0%',    color: '#fda4af', test: p => p >= -25 && p < 0 },
  { label: '0…25%',     color: '#86efac', test: p => p >= 0 && p < 25 },
  { label: '25…50%',    color: '#34d399', test: p => p >= 25 && p < 50 },
  { label: '> 50%',     color: '#10b981', test: p => p >= 50 },
]

/**
 * Distribution of positions by unrealized P/L %. Answers "how many of my
 * positions are winning vs bleeding" at a glance — a different question from
 * allocation, hence its own display.
 */
export function PlHistogram({ items }: { items: { unrealizedPlPct: number }[] }) {
  const { tip, show, move, hide } = useChartTooltip()
  const counts = BUCKETS.map(b => items.filter(i => b.test(i.unrealizedPlPct)).length)
  const max = Math.max(1, ...counts)

  return (
    <>
      <div className="histo">
        {BUCKETS.map((b, i) => (
          <div
            key={b.label}
            className="histo-col"
            onMouseEnter={e => show(e, b.label, `${counts[i]} ${counts[i] === 1 ? 'position' : 'positions'}`)}
            onMouseMove={move}
            onMouseLeave={hide}
          >
            <span className="histo-count">{counts[i]}</span>
            <div className="histo-bar-track">
              <div
                className="histo-bar"
                style={{ height: `${(counts[i] / max) * 100}%`, background: b.color }}
              />
            </div>
            <span className="histo-label">{b.label}</span>
          </div>
        ))}
      </div>
      <ChartTooltip tip={tip} />
    </>
  )
}
