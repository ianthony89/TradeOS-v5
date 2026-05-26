'use client'
// ============================================================
//  TradeOS v5 — Holdings Store (Zustand)
// ============================================================

import { create } from 'zustand'
import type { Quote } from '@/lib/market/types'

export interface Holding {
  id:               string
  symbol:           string
  symbolNormalized: string
  name:             string
  quantity:         number
  availableQty:     number
  avgCost:          number
  currentPrice:     number
  marketValue:      number
  unrealizedPl:     number
  unrealizedPlPct:  number
  realizedPl:       number
  todayPl:          number
  currency:         string
  assetType:        string
  sector:           string | null
  targetPrice:      number | null
  stopLoss:         number | null
  notes:            string | null
  portfolioWeight:  number
  quotesUpdatedAt:  string | null
}

interface HoldingsState {
  holdings:       Holding[]
  quotes:         Map<string, Quote>
  loading:        boolean
  lastImportAt:   string | null
  quoteRefreshing:boolean

  setHoldings:    (h: Holding[]) => void
  updateQuotes:   (quotes: Quote[]) => void
  setLoading:     (v: boolean) => void
  setLastImport:  (at: string) => void
  setRefreshing:  (v: boolean) => void
  updateHolding:  (id: string, patch: Partial<Holding>) => void
}

export const useHoldingsStore = create<HoldingsState>((set) => ({
  holdings:        [],
  quotes:          new Map(),
  loading:         false,
  lastImportAt:    null,
  quoteRefreshing: false,

  setHoldings:  (holdings) => set({ holdings }),
  updateQuotes: (newQuotes) =>
    set(state => {
      const m = new Map(state.quotes)
      for (const q of newQuotes) m.set(q.symbol, q)
      return { quotes: m }
    }),
  setLoading:    (loading)  => set({ loading }),
  setLastImport: (at)       => set({ lastImportAt: at }),
  setRefreshing: (v)        => set({ quoteRefreshing: v }),
  updateHolding: (id, patch) =>
    set(state => ({
      holdings: state.holdings.map(h => h.id === id ? { ...h, ...patch } : h),
    })),
}))

// ── Derived selectors ─────────────────────────────────────────
export function getTotalValue(holdings: Holding[], fxRate: number) {
  let usd = 0, myr = 0
  for (const h of holdings) {
    if (h.currency === 'MYR') myr += h.marketValue
    else                      usd += h.marketValue
  }
  return { usd, myr, combined: usd + (myr / fxRate) }
}

export function getTodayPl(holdings: Holding[]) {
  return holdings.reduce((sum, h) => sum + (h.todayPl ?? 0), 0)
}

export function getTotalUnrealizedPl(holdings: Holding[]) {
  return holdings.reduce((sum, h) => sum + (h.unrealizedPl ?? 0), 0)
}
