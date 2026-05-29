'use client'

// ============================================================
//  TradeOS v5 — Market-level shared client state
//  Holds: FX preferences + live rate + sync timestamps.
//  Separate from holdings store — never touches portfolio data.
//
//  Persisted to localStorage (user preferences only):
//    fxMode · fxManualRate · primaryCurrency
//  Session-only (not persisted):
//    fxLiveRate · fxUpdatedAt · quotesUpdatedAt
// ============================================================

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export type FxMode   = 'manual' | 'live'
export type Currency = 'USD' | 'MYR'

interface MarketStoreState {
  /** User preference: manual entry or live sync. Defaults to manual per product truth rule. */
  fxMode:           FxMode
  /** Manual reference rate (USD/MYR). Default 4.00. */
  fxManualRate:     number
  /** Last successful live fetch. 0 means not yet fetched. */
  fxLiveRate:       number
  /** Timestamp of last successful live fetch. */
  fxUpdatedAt:      Date | null
  /** User preference: which currency is the primary view. */
  primaryCurrency:  Currency
  /** Last successful /api/quotes refresh — drives the SyncPill freshness indicator. */
  quotesUpdatedAt:  Date | null

  setFxMode:          (mode: FxMode) => void
  setFxManualRate:    (rate: number) => void
  setFxLiveRate:      (rate: number, ts: Date) => void
  setPrimaryCurrency: (currency: Currency) => void
  setQuotesUpdated:   (ts: Date) => void
}

export const useMarketStore = create<MarketStoreState>()(
  persist(
    (set) => ({
      fxMode:           'manual',
      fxManualRate:     4.00,
      fxLiveRate:       0,
      fxUpdatedAt:      null,
      primaryCurrency:  'USD',
      quotesUpdatedAt:  null,

      setFxMode:          (fxMode)          => set({ fxMode }),
      setFxManualRate:    (fxManualRate)    => set({ fxManualRate }),
      setFxLiveRate:      (rate, ts)        => set({ fxLiveRate: rate, fxUpdatedAt: ts }),
      setPrimaryCurrency: (primaryCurrency) => set({ primaryCurrency }),
      setQuotesUpdated:   (quotesUpdatedAt) => set({ quotesUpdatedAt }),
    }),
    {
      name:    'tradeos-market',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        fxMode:          state.fxMode,
        fxManualRate:    state.fxManualRate,
        primaryCurrency: state.primaryCurrency,
      }),
      version: 1,
    },
  ),
)

/**
 * Compute the currently-active USD/MYR rate based on user mode.
 *   - Manual mode → always returns the user's manual rate
 *   - Live mode + successful fetch → returns the live rate
 *   - Live mode but no fetch yet → falls back to manual rate
 *
 * Usage:  const fx = useMarketStore(selectActiveFxRate)
 */
export function selectActiveFxRate(s: MarketStoreState): number {
  if (s.fxMode === 'live' && s.fxLiveRate > 0) return s.fxLiveRate
  return s.fxManualRate
}
