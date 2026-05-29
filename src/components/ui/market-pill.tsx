'use client'

import { useClock } from '@/lib/hooks/use-clock'
import { getMarketState, type Market } from '@/lib/market/market-hours'
import { useT } from '@/lib/i18n/context'
import type { ReactNode } from 'react'

interface MarketPillProps {
  market:    Market
  flag:      ReactNode
  className?: string
}

/**
 * Live market state pill — ticks every second.
 * Shows flag, market code, live clock (HH:MM:SS), and current session.
 * Status color: open → emerald, pre → blue, after → amber, closed → mute.
 */
export function MarketPill({ market, flag, className = '' }: MarketPillProps) {
  useClock(1000)
  const t = useT()
  const state = getMarketState(market)

  return (
    <span className={`market-pill ${className}`} data-tone={state.tone}>
      <span className="market-pill-flag">{flag}</span>
      <span className="market-pill-code">{market}</span>
      <span className="market-pill-time text-tabular">{state.clock}</span>
      <span className="market-pill-sep">·</span>
      <span className={`market-pill-state market-pill-state--${state.tone}`}>
        {t(state.labelKey)}
      </span>
    </span>
  )
}
