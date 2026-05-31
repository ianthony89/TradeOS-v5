'use client'

import { useT } from '@/lib/i18n/context'
import { fmt } from '@/lib/utils/format'
import type { DonutSlice } from './donut-chart'
import { DonutChart }     from './donut-chart'
import { TreemapChart, type StarItem } from './treemap-chart'

export type AllocView = 'donut' | 'tree'

export const ALLOC_VIEWS: { id: AllocView; label: string }[] = [
  { id: 'donut', label: 'Donut'   },
  { id: 'tree',  label: 'Treemap' },
]

export function nextAllocView(v: AllocView): AllocView {
  const i = ALLOC_VIEWS.findIndex(x => x.id === v)
  return ALLOC_VIEWS[(i + 1) % ALLOC_VIEWS.length].id
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

/**
 * Sector allocation body. The view is controlled by the parent (the swap
 * control lives in the panel header to save vertical space). All views share
 * one legend and hover tooltips.
 */
export function AllocationViews({
  slices,
  centerValue,
  stars = [],
  view,
}: {
  slices:       DonutSlice[]
  centerValue?: string
  stars?:       StarItem[]
  view:         AllocView
}) {
  const t = useT()

  if (!slices.length) {
    return <div className="text-tertiary" style={{ fontSize: 12 }}>{t('alloc_empty')}</div>
  }

  return (
    <div className="alloc">
      <div className="alloc-stage">
        {view === 'donut' && (
          <DonutChart slices={slices} centerValue={centerValue} centerLabel={t('alloc_center')} size={220} thickness={28} />
        )}
        {view === 'tree'   && <TreemapChart slices={slices} stars={stars} />}
      </div>

      <div className="donut-legend">
        {chunk(slices, 3).map((row, i) => (
          <div key={i} className="donut-legend-row">
            {row.map(s => (
              <div key={s.name} className="donut-legend-item">
                <span className="donut-legend-dot" style={{ background: s.color }} />
                <span className="donut-legend-name">{s.name}</span>
                <span className="donut-legend-pct">{fmt.pct(s.pct, 1)}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
