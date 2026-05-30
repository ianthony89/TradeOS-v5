'use client'

import { useMarketStore } from '@/stores/market'
import { useClock }       from '@/lib/hooks/use-clock'
import { useI18n }        from '@/lib/i18n/context'
import { fmt }            from '@/lib/utils/format'
import { CheckCircle2, CircleDashed } from 'lucide-react'

/**
 * Quote freshness indicator.
 * Re-renders every 30s to update the relative-time label.
 */
export function SyncPill({ className = '' }: { className?: string }) {
  const { t, lang } = useI18n()
  useClock(30_000)
  const ts = useMarketStore(s => s.quotesUpdatedAt)

  if (!ts) {
    return (
      <span className={`market-pill ${className}`}>
        <CircleDashed size={11} className="text-quaternary" />
        <span className="market-pill-state market-pill-state--closed">{t('sync_idle')}</span>
      </span>
    )
  }

  // useClock(30s) above drives re-renders so this read is deliberate.
  // eslint-disable-next-line react-hooks/purity
  const ageMs = Date.now() - ts.getTime()
  const stale = ageMs > 60 * 60 * 1000   // >1h
  return (
    <span className={`market-pill ${className}`} title={ts.toLocaleString()}>
      <CheckCircle2 size={11} className={stale ? 'text-tertiary' : 'text-positive'} />
      <span className={`market-pill-state ${stale ? 'market-pill-state--closed' : 'market-pill-state--open'}`}>
        {t('sync_quotes')} {fmt.relativeTime(ts, lang)}
      </span>
    </span>
  )
}
