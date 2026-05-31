'use client'

import { Layers } from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { fmt } from '@/lib/utils/format'
import { DonutChart, type DonutSlice, type StarItem } from './donut-chart'
import { AllocationList } from './allocation-list'

export type AllocView = 'donut' | 'list'

export const ALLOC_VIEWS: { id: AllocView; label: string }[] = [
  { id: 'donut', label: 'Donut' },
  { id: 'list',  label: 'List'  },
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
  total = 0,
  view,
}: {
  slices:       DonutSlice[]
  centerValue?: string
  stars?:       StarItem[]
  total?:       number
  view:         AllocView
}) {
  const t = useT()

  if (!slices.length) {
    return <div className="text-tertiary" style={{ fontSize: 12 }}>{t('alloc_empty')}</div>
  }

  return (
    <div className="alloc-views">
      {/* The ranked list sizes to its content. */}
      {view === 'list' && <AllocationList slices={slices} stars={stars} total={total} />}

      {/* Donut + legend, centred in the space above the footer. */}
      {view === 'donut' && (
        <div className="alloc alloc--center">
          <div className="alloc-stage">
            <DonutChart slices={slices} centerValue={centerValue} centerLabel={t('alloc_center')} />
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
      )}

      <AllocationInsight slices={slices} />
    </div>
  )
}

/**
 * Diversification footer — a plain-language read on how concentrated the book
 * is (effective number of sectors via the inverse Herfindahl index). Pinned to
 * the bottom of the panel so every view ends on the same insight and the panel
 * never shows a void under short content.
 */
function AllocationInsight({ slices }: { slices: DonutSlice[] }) {
  const t = useT()
  const active = slices.filter(s => s.pct > 0).sort((a, b) => b.pct - a.pct)
  if (active.length < 2) return null

  const sumSq     = active.reduce((s, x) => s + (x.pct / 100) ** 2, 0)
  const effective = sumSq > 0 ? 1 / sumSq : 0
  const topN      = Math.min(2, active.length)
  const topWeight = active.slice(0, topN).reduce((s, x) => s + x.pct, 0)
  const top1      = active[0].pct

  const verdict = top1 >= 50 ? 'concentrated' : top1 >= 30 ? 'balanced' : 'diversified'
  const tone    = verdict === 'concentrated' ? 'warning' : verdict === 'diversified' ? 'positive' : 'accent'

  return (
    <div className="alloc-insight">
      <div className="alloc-insight-head">
        <Layers size={12} />
        {t('alloc_diversification')}
        <span className="alloc-insight-verdict" data-tone={tone}>{t(`alloc_verdict_${verdict}`)}</span>
      </div>
      <p className="alloc-insight-read">
        {t('alloc_insight_read', { eff: effective.toFixed(1), n: active.length, topN, pct: fmt.pct(topWeight, 1) })}
      </p>
    </div>
  )
}
