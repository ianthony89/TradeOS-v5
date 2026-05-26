// ============================================================
//  TradeOS v5 — Market Router
//  Single entry point for all market data.
//  Orchestrates: cache → provider routing → fallback chain
//
//  CTO routing spec:
//    MY_EQUITY  → Yahoo quotes/historical | Finnhub news (best-effort)
//    US_EQUITY  → Yahoo quotes/historical | Finnhub fallback | Finnhub news
//    ETF        → same as US_EQUITY
//    INDEX      → Yahoo only
//    CRYPTO     → Yahoo only
//    NEWS       → Finnhub only (primary)
// ============================================================

import type { Quote, Candle, NewsItem, RouterOptions } from './types'
import { detectAssetType } from './asset-type'
import {
  getCachedQuote, setCachedQuote,
  getCachedQuotes, setCachedQuotes,
  getCachedNews, setCachedNews,
  getCachedHistorical, setCachedHistorical,
} from './cache'
import { yahooProvider }   from './providers/yahoo-provider'
import { finnhubProvider } from './providers/finnhub-provider'

// ── getQuote ──────────────────────────────────────────────────
export async function getQuote(
  symbol: string,
  opts: RouterOptions = {},
): Promise<Quote> {
  // 1. Cache check
  if (!opts.skipCache) {
    const cached = await getCachedQuote(symbol)
    if (cached) return { ...cached, source: 'cache' }
  }

  const assetType = detectAssetType(symbol)

  // 2. Provider routing with fallback
  let quote: Quote

  if (assetType === 'MY_EQUITY' || assetType === 'INDEX' || assetType === 'CRYPTO') {
    // Yahoo only for these asset types
    quote = await yahooProvider.getQuote(symbol)
  } else {
    // US_EQUITY / ETF → Yahoo primary, Finnhub fallback
    try {
      quote = await yahooProvider.getQuote(symbol)
    } catch {
      quote = await finnhubProvider.getQuote(symbol)
    }
  }

  // 3. Cache result
  await setCachedQuote(symbol, quote)
  return quote
}

// ── getQuotes (batch) ─────────────────────────────────────────
export async function getQuotes(
  symbols: string[],
  opts: RouterOptions = {},
): Promise<Quote[]> {
  if (!symbols.length) return []

  // 1. Check cache for all symbols
  const cachedMap  = opts.skipCache ? new Map() : await getCachedQuotes(symbols)
  const cached     = [...cachedMap.values()].map(q => ({ ...q, source: 'cache' as const }))
  const missing    = symbols.filter(s => !cachedMap.has(s))

  if (!missing.length) return cached

  // 2. Partition missing by asset type
  const mySymbols  = missing.filter(s => detectAssetType(s) === 'MY_EQUITY')
  const idxSymbols = missing.filter(s => ['INDEX','CRYPTO'].includes(detectAssetType(s)))
  const usSymbols  = missing.filter(s => !mySymbols.includes(s) && !idxSymbols.includes(s))

  const fresh: Quote[] = []

  // MY + INDEX + CRYPTO → Yahoo only
  const yahooSymbols = [...mySymbols, ...idxSymbols]
  if (yahooSymbols.length) {
    const qs = await yahooProvider.getQuotes(yahooSymbols)
    fresh.push(...qs)
  }

  // US symbols → Yahoo, then Finnhub fallback for any that failed
  if (usSymbols.length) {
    const yahooResults = await yahooProvider.getQuotes(usSymbols)
    const gotSymbols   = new Set(yahooResults.map(q => q.symbol))
    const stillMissing = usSymbols.filter(s => !gotSymbols.has(s))

    fresh.push(...yahooResults)

    if (stillMissing.length) {
      const fbResults = await finnhubProvider.getQuotes(stillMissing)
      fresh.push(...fbResults)
    }
  }

  // 3. Cache fresh results
  await setCachedQuotes(fresh)

  return [...cached, ...fresh]
}

// ── getHistorical ─────────────────────────────────────────────
export async function getHistorical(
  symbol: string,
  from:   Date,
  to:     Date,
  opts:   RouterOptions = {},
): Promise<Candle[]> {
  const range = `${from.toISOString().split('T')[0]}_${to.toISOString().split('T')[0]}`

  if (!opts.skipCache) {
    const cached = await getCachedHistorical(symbol, range)
    if (cached) return cached
  }

  const candles = await yahooProvider.getHistorical(symbol, from, to)
  await setCachedHistorical(symbol, range, candles)
  return candles
}

// ── getNews ───────────────────────────────────────────────────
export async function getNews(
  symbol: string,
  opts:   RouterOptions = {},
): Promise<NewsItem[]> {
  if (!opts.skipCache) {
    const cached = await getCachedNews(symbol)
    if (cached) return cached
  }

  const news = await finnhubProvider.getNews(symbol)
  await setCachedNews(symbol, news)
  return news
}

// ── getFxRate ─────────────────────────────────────────────────
// Uses Yahoo Finance to get USD/MYR or other FX pairs
export async function getFxRate(
  from: string,
  to:   string,
): Promise<number> {
  if (from === to) return 1

  // Yahoo FX format: USDMYR=X
  const symbol = `${from}${to}=X`

  try {
    const quote = await getQuote(symbol)
    return quote.price
  } catch {
    // Hardcoded fallback — should never be relied on long-term
    if (from === 'USD' && to === 'MYR') return 4.7
    if (from === 'MYR' && to === 'USD') return 1 / 4.7
    return 1
  }
}
