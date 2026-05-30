'use client'

import { useState } from 'react'
import { fmt } from '@/lib/utils/format'
import type { DonutSlice } from './donut-chart'
import { DonutChart }     from './donut-chart'
import { TreemapChart }   from './treemap-chart'
import { CategoricalBar } from './categorical-bar'

type View = 'tree' | 'donut' | 'bar'

const VIEWS: { id: View; label: string }[] = [
  { id: 'tree',  label: 'Treemap' },
  { id: 'donut', label: 'Donut'   },
  { id: 'bar',   label: 'Bar'     },
]

/**
 * Sector allocation with a view switcher (Treemap default · Donut · Bar).
 * All three answer the same question — "what's my sector split" — and share
 * one legend. Every view has hover tooltips.
 */
export function AllocationViews({
  slices,
  centerValue,
}: {
  slices:       DonutSlice[]
  centerValue?: string
}) {
  const [view, setView] = useState<View>('tree')

  if (!slices.length) {
    return <div className="text-tertiary" style={{ fontSize: 12 }}>Allocation will appear once positions load.</div>
  }

  return (
    <div className="alloc">
      <div className="alloc-switch">
        <div className="chip-group" role="group" aria-label="Allocation view">
          {VIEWS.map(v => (
            <button
              key={v.id}
              type="button"
              onClick={() => setView(v.id)}
              className={`chip${view === v.id ? ' chip--active' : ''}`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      <div className="alloc-stage">
        {view === 'tree'  && <TreemapChart slices={slices} />}
        {view === 'donut' && (
          <DonutChart slices={slices} centerValue={centerValue} centerLabel="Market value" size={220} thickness={28} />
        )}
        {view === 'bar'   && <CategoricalBar slices={slices} />}
      </div>

      <div className="donut-legend">
        {slices.map(s => (
          <div key={s.name} className="donut-legend-item">
            <span className="donut-legend-dot" style={{ background: s.color }} />
            <span className="donut-legend-name">{s.name}</span>
            <span className="donut-legend-pct">{fmt.pct(s.pct, 1)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
