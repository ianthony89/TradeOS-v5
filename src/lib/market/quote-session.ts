// ============================================================
//  TradeOS v5 — Quote session (display-layer, v5.0.3)
//  Pure helpers: classify which trading session a quote / the US
//  clock is in, and compute the extended-hours (pre/post) move.
//
//  Display-honesty only. Reads existing Quote fields, never mutates
//  them, never touches the frozen market layer (providers / router /
//  api / types). Today's P&L is NOT derived here.
// ============================================================

import type { Quote } from '@/lib/market/types'
import { getMarketState, type MarketSession } from '@/lib/market/market-hours'

export type QuoteSession = 'REGULAR' | 'PRE_MARKET' | 'POST_MARKET' | 'OVERNIGHT_CLOSE'

/** Classify a quote's session from its Yahoo marketState. */
export function classifyQuoteSession(marketState: Quote['marketState'] | undefined): QuoteSession {
  switch (marketState) {
    case 'REGULAR': return 'REGULAR'
    case 'PRE':
    case 'PREPRE':  return 'PRE_MARKET'
    case 'POST':    return 'POST_MARKET'
    default:        return 'OVERNIGHT_CLOSE'   // POSTPOST / CLOSED / undefined
  }
}

/** Map the US market clock to a quote session (drives the freshness pill + Holdings banner). */
export function sessionFromUsClock(session: MarketSession): QuoteSession {
  switch (session) {
    case 'open':        return 'REGULAR'
    case 'pre-market':  return 'PRE_MARKET'
    case 'after-hours': return 'POST_MARKET'
    default:            return 'OVERNIGHT_CLOSE'   // overnight / closed / pre-open / etc.
  }
}

/** Current US quote session from the live clock. */
export function currentUsSession(): QuoteSession {
  return sessionFromUsClock(getMarketState('US').session)
}

export interface SessionMove {
  session: 'PRE_MARKET' | 'POST_MARKET'
  move:    number   // price delta vs the regular-session close
  movePct: number
}

/**
 * Extended-hours move: pre/post price vs the regular close.
 * Returns null for REGULAR / OVERNIGHT_CLOSE, or when the extended price
 * is missing. Pure display arithmetic — this NEVER feeds Today's P&L.
 */
export function sessionMove(quote: Quote | undefined): SessionMove | null {
  if (!quote) return null
  const close = quote.regularMarketPrice
  if (!close || close <= 0) return null

  const session = classifyQuoteSession(quote.marketState)
  if (session === 'PRE_MARKET' && quote.preMarketPrice && quote.preMarketPrice > 0) {
    const move = quote.preMarketPrice - close
    return { session, move, movePct: (move / close) * 100 }
  }
  if (session === 'POST_MARKET' && quote.postMarketPrice && quote.postMarketPrice > 0) {
    const move = quote.postMarketPrice - close
    return { session, move, movePct: (move / close) * 100 }
  }
  return null
}
