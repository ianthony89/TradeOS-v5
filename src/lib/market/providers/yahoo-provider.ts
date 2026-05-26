// ============================================================
//  TradeOS v5 — Yahoo Finance Provider
//  Handles: getQuote, getQuotes, getHistorical
//  Does NOT handle: news (Finnhub is cleaner)
// ============================================================

import yahooFinance from 'yahoo-finance2'
import type { Quote, Candle, NewsItem, MarketDataProvider } from '../types'
import { detectAssetType } from '../asset-type'

export class YahooProvider implements MarketDataProvider {
  // ── getQuote ───────────────────────────────────────────────
  async getQuote(symbol: string): Promise<Quote> {
    const raw = await yahooFinance.quote(symbol, {}, { validateResult: false })

    const marketState = (raw.marketState ?? 'CLOSED') as Quote['marketState']

    // Best current price: pre/post if market is not regular, else regular
    let price = raw.regularMarketPrice ?? 0
    if (marketState === 'PRE'  && raw.preMarketPrice)  price = raw.preMarketPrice
    if (marketState === 'POST' && raw.postMarketPrice) price = raw.postMarketPrice

    return {
      symbol,
      regularMarketPrice: raw.regularMarketPrice    ?? 0,
      price,
      preMarketPrice:     raw.preMarketPrice        ?? undefined,
      postMarketPrice:    raw.postMarketPrice       ?? undefined,
      change:             raw.regularMarketChange   ?? 0,
      changePercent:      raw.regularMarketChangePercent ?? 0,
      currency:           raw.currency              ?? 'USD',
      marketState,
      volume:             raw.regularMarketVolume   ?? undefined,
      marketCap:          raw.marketCap             ?? undefined,
      fiftyTwoWeekHigh:   raw.fiftyTwoWeekHigh      ?? undefined,
      fiftyTwoWeekLow:    raw.fiftyTwoWeekLow       ?? undefined,
      timestamp:          new Date().toISOString(),
      source:             'yahoo',
      assetType:          detectAssetType(symbol, raw.quoteType),
    }
  }

  // ── getQuotes (batch) ─────────────────────────────────────
  async getQuotes(symbols: string[]): Promise<Quote[]> {
    if (!symbols.length) return []

    // yahoo-finance2 quoteSummary is single-symbol; use quote() in parallel
    // but chunk to avoid overwhelming Yahoo (max 10 concurrent)
    const CHUNK = 10
    const results: Quote[] = []

    for (let i = 0; i < symbols.length; i += CHUNK) {
      const chunk = symbols.slice(i, i + CHUNK)
      const settled = await Promise.allSettled(chunk.map(s => this.getQuote(s)))
      for (const r of settled) {
        if (r.status === 'fulfilled') results.push(r.value)
      }
    }

    return results
  }

  // ── getHistorical ─────────────────────────────────────────
  async getHistorical(symbol: string, from: Date, to: Date): Promise<Candle[]> {
    const raw = await yahooFinance.historical(symbol, {
      period1: from.toISOString().split('T')[0],
      period2: to.toISOString().split('T')[0],
      interval: '1d',
    })

    return raw.map(r => ({
      time:   r.date.toISOString().split('T')[0],
      open:   r.open  ?? r.close,
      high:   r.high  ?? r.close,
      low:    r.low   ?? r.close,
      close:  r.close,
      volume: r.volume ?? 0,
    }))
  }

  // ── getNews — NOT implemented; use Finnhub ─────────────────
  async getNews(_symbol: string): Promise<NewsItem[]> {
    throw new Error('YahooProvider does not support news. Use FinnhubProvider.')
  }
}

// Singleton export
export const yahooProvider = new YahooProvider()
