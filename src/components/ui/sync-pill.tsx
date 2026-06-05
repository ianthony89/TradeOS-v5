'use client'

import { useMarketStore } from '@/stores/market'
import { useClock }       from '@/lib/hooks/use-clock'
import { useI18n }        from '@/lib/i18n/context'

/**
 * Compact quote-freshness pill (v5.0.8).
 * One colour-coded pill, no verbose "Quotes 16m ago" text:
 *   🟢 LIVE   (< 3 min)
 *   🟡 {n}m   (3–15 min, getting stale)
 *   🔴 {n}m   (≥ 15 min, very stale)
 * Re-renders every 30s to keep the age current. Market-session honesty
 * (Last Close / Pre / Post) lives on the Holdings banner, not here.
 */
export function SyncPill({ className = '' }: { className?: string }) {
  const { t } = useI18n()
  useClock(30_000)
  const ts = useMarketStore(s => s.quotesUpdatedAt)

  if (!ts) {
    return (
      <span className={`fresh-pill fresh-pill--idle ${className}`} title={t('sync_idle')}>
        <span className="fresh-dot" />
        <span className="fresh-label">—</span>
      </span>
    )
  }

  // useClock(30s) drives the re-render, so reading the clock here is deliberate.
  // eslint-disable-next-line react-hooks/purity
  const mins  = Math.max(0, Math.floor((Date.now() - ts.getTime()) / 60_000))
  const tone  = mins < 3 ? 'live' : mins < 15 ? 'stale' : 'old'
  const label = mins < 3 ? t('sync_live') : `${mins}m`

  return (
    <span className={`fresh-pill fresh-pill--${tone} ${className}`} title={ts.toLocaleString()}>
      <span className="fresh-dot" />
      <span className="fresh-label">{label}</span>
    </span>
  )
}
