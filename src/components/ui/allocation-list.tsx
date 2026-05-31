'use client'

import { useState } from 'react'
import { useT } from '@/lib/i18n/context'
import { fmt } from '@/lib/utils/format'
import type { DonutSlice, StarItem } from './donut-chart'
import { useChartTooltip, ChartTooltip } from './chart-tooltip'

/**
 * Ranked allocation — a thin sector "spectrum" bar (5-second overview) over a
 * sorted bar list. Length on a shared axis is the most accurately-read
 * encoding, so this beats a pie for "how concentrated am I". Toggles between
 * sector level and individual holdings.
 */
export function AllocationList({
  slices, stars, total,
}: {
  slices: DonutSlice[]
  stars:  StarItem[]
  total:  number
}) {
  const t = useT()
  const { tip, show, move, hide } = useChartTooltip()
  const [level, setLevel] = useState<'sector' | 'holding'>('sector')

  const sectors = [...slices].filter(s => s.pct > 0).sort((a, b) => b.pct - a.pct)
  const top = sectors[0]

  const rows = level === 'sector'
    ? sectors.map(s => ({ key: s.name, name: s.name, pct: s.pct, value: s.value, color: s.color }))
    : [...stars].sort((a, b) => b.weight - a.weight)
        .map(h => ({ key: h.symbol, name: h.symbol, pct: h.weight, value: total * h.weight / 100, color: h.color }))
  const max = rows[0]?.pct || 1

  return (
    <div className="alloc-list">
      <div className="alloc-list-head">
        <div className="chip-group" role="group" aria-label="Allocation level">
          <button type="button" className={`chip${level === 'sector' ? ' chip--active' : ''}`} onClick={() => setLevel('sector')}>
            {t('alloc_sectors')}
          </button>
          <button type="button" className={`chip${level === 'holding' ? ' chip--active' : ''}`} onClick={() => setLevel('holding')}>
            {t('alloc_holdings')}
          </button>
        </div>
      </div>

      {/* Spectrum — always sectors, the 5-second overview */}
      <div className="alloc-spectrum">
        {sectors.map(s => (
          <div
            key={s.name} className="alloc-spec" style={{ flex: s.pct, background: s.color }}
            onMouseEnter={e => show(e, s.name, `${fmt.money(s.value, 'USD')} · ${fmt.pct(s.pct, 1)}`)}
            onMouseMove={move} onMouseLeave={hide}
          />
        ))}
      </div>
      {top && (
        <div className="alloc-cap">
          <span>{t('alloc_concentrated')}: <b>{top.name} {fmt.pct(top.pct, 1)}</b></span>
          <span>{t('alloc_summary', { s: slices.length, h: stars.length })}</span>
        </div>
      )}

      <div className="alloc-rows">
        {rows.map((r, i) => (
          <div
            key={r.key} className="alloc-row"
            onMouseEnter={e => show(e, r.name, `${fmt.money(r.value, 'USD')} · ${fmt.pct(r.pct, 1)}`)}
            onMouseMove={move} onMouseLeave={hide}
          >
            <div className="alloc-name">
              <span className="alloc-dot" style={{ background: r.color }} />
              <span className="alloc-nm">{r.name}</span>
            </div>
            <div className="alloc-track">
              <div className="alloc-fill" style={{ width: `${(r.pct / max) * 100}%`, background: r.color, animationDelay: `${i * 0.04}s` }} />
            </div>
            <div className="alloc-val">
              <div className="alloc-pct text-mono text-tabular">{fmt.pct(r.pct, 1)}</div>
              <div className="alloc-cash text-tabular">{fmt.compact(r.value, 'USD')}</div>
            </div>
          </div>
        ))}
      </div>
      <ChartTooltip tip={tip} />
    </div>
  )
}
