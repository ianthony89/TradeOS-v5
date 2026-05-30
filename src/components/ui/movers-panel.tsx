'use client'

import { TrendingUp, TrendingDown } from 'lucide-react'
import { useT } from '@/lib/i18n/context'
import { fmt } from '@/lib/utils/format'
import { SymCell } from '@/components/brand/stock-logo'
import { DeltaMoney } from '@/components/ui/delta-badge'

export interface MoverItem {
  id:               string
  symbol:           string
  name:             string | null
  currency:         string
  unrealizedPl:     number
  unrealizedPlPct:  number
}

interface MoversPanelProps {
  winners:    MoverItem[]
  losers:     MoverItem[]
  className?: string
}

/**
 * Top movers panel — single panel, two visually distinct sections.
 *
 *   ▲ TOP WINNERS
 *   <up to 3 rows>
 *   ────────────────
 *   ▼ TOP LOSERS
 *   <up to 3 rows>
 *
 * Per AGENTS.md § 4: intentionally capped, no unlimited spam.
 */
export function MoversPanel({ winners, losers, className = '' }: MoversPanelProps) {
  const t = useT()
  const hasNone = !winners.length && !losers.length
  if (hasNone) {
    return (
      <div className={`movers-empty ${className}`}>
        {t('movers_empty')}
      </div>
    )
  }
  return (
    <div className={`movers-panel ${className}`}>
      {!!winners.length && (
        <div className="movers-section">
          <div className="movers-section-head movers-section-head--positive">
            <TrendingUp size={12} />
            <span>{t('movers_winners')}</span>
          </div>
          <div className="movers-list">
            {winners.map(m => <MoverRow key={m.id} m={m} direction="up" />)}
          </div>
        </div>
      )}

      {!!winners.length && !!losers.length && <div className="movers-divider" />}

      {!!losers.length && (
        <div className="movers-section">
          <div className="movers-section-head movers-section-head--negative">
            <TrendingDown size={12} />
            <span>{t('movers_losers')}</span>
          </div>
          <div className="movers-list">
            {losers.map(m => <MoverRow key={m.id} m={m} direction="down" />)}
          </div>
        </div>
      )}
    </div>
  )
}

function MoverRow({ m, direction }: { m: MoverItem; direction: 'up' | 'down' }) {
  const tone = direction === 'up' ? 'positive' : 'negative'
  return (
    <div className="mover-row">
      <SymCell symbol={m.symbol} name={m.name} currency={m.currency} logoSize={28} />
      <div className="mover-row-right">
        <span className={`mover-row-pct text-tabular text-${tone}`}>
          {fmt.pctSigned(m.unrealizedPlPct, 2)}
        </span>
        <DeltaMoney value={m.unrealizedPl} currency={m.currency} variant="inline" className="mover-row-money" />
      </div>
    </div>
  )
}
