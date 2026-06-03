// ============================================================
//  TradeOS v5 — Live-price overlay (Phase 2E QA)
//  Recompute a holding's monetary fields from a live quote, the same
//  way the Dashboard does. Lets the Position Hub / Planner / Journal
//  show the same fresh numbers as the Dashboard instead of the stored
//  DB snapshot. Pure — no I/O.
// ============================================================

export interface PriceQuote { price: number; change?: number }

export interface LiveBase {
  currentPrice:    number
  marketValue:     number
  unrealizedPl:    number
  unrealizedPlPct: number
  todayPl:         number
  avgCost:         number
  quantity:        number
}

export type LiveFields = Pick<LiveBase, 'currentPrice' | 'marketValue' | 'unrealizedPl' | 'unrealizedPlPct' | 'todayPl'>

/** Overlay a live quote onto a holding. Falls back to the stored values when no usable quote exists. */
export function applyLiveQuote(base: LiveBase, quote: PriceQuote | undefined): LiveFields {
  if (!quote || !(quote.price > 0)) {
    return {
      currentPrice:    base.currentPrice,
      marketValue:     base.marketValue,
      unrealizedPl:    base.unrealizedPl,
      unrealizedPlPct: base.unrealizedPlPct,
      todayPl:         base.todayPl,
    }
  }
  const price = quote.price
  return {
    currentPrice:    price,
    marketValue:     price * base.quantity,
    unrealizedPl:    (price - base.avgCost) * base.quantity,
    unrealizedPlPct: base.avgCost > 0 ? ((price - base.avgCost) / base.avgCost) * 100 : 0,
    todayPl:         (quote.change ?? 0) * base.quantity,
  }
}
