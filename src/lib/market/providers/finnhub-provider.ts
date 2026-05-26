// ============================================================
//  TradeOS v5 — Finnhub Provider
//  Handles: getQuote (US fallback), getNews (primary)
//  Free tier: 60 req/min — server-side cache protects this
// ============================================================

import type { Quote, Candle, NewsItem, MarketDataProvider } from '../types'
import { detectAssetType } from '../asset-type'

const BASE = 'https://finnhub.io/api/v1'

function apiKey(): string {
  const k = process.env.FINNHUB_API_KEY
  if (!k) throw new Error('[finnhub] FINNHUB_API_KEY not configured')
  return k
}

async function get<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${BASE}${path}`)
  url.searchParams.set('token', apiKey())
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)

  const res = await fetch(url.toString(), { next: { revalidate: 0 } })
  if (!res.ok) throw new Error(`[finnhub] ${path} → HTTP ${res.status}`)
  return res.json() as Promise<T>
}

// ── Finnhub API shapes ────────────────────────────────────────
interface FinnhubQuote {
  c:  number   // current price
  d:  number   // change
  dp: number   // change percent
  h:  number   // high
  l:  number   // low
  o:  number   // open
  pc: number   // prev close
  t:  number   // timestamp (unix)
}

interface FinnhubNewsItem {
  id:       number
  headline: string
  summary:  string
  source:   string
  url:      string
  image:    string
  datetime: number   // unix
  related:  string
}

export class FinnhubProvider implements MarketDataProvider {
  // ── getQuote ───────────────────────────────────────────────
  async getQuote(symbol: string): Promise<Quote> {
    const raw = await get<FinnhubQuote>('/quote', { symbol })

    if (!raw.c || raw.c === 0) {
      throw new Error(`[finnhub] No quote data for ${symbol}`)
    }

    return {
      symbol,
      regularMarketPrice: raw.pc,
      price:              raw.c,
      change:             raw.d  ?? 0,
      changePercent:      raw.dp ?? 0,
      currency:           'USD',      // Finnhub free = US symbols only
      marketState:        'REGULAR',  // Finnhub free doesn't expose market state
      timestamp:          new Date(raw.t * 1000).toISOString(),
      source:             'finnhub',
      assetType:          detectAssetType(symbol),
    }
  }

  // ── getQuotes (batch — sequential to respect 60/min) ──────
  async getQuotes(symbols: string[]): Promise<Quote[]> {
    const results: Quote[] = []
    for (const s of symbols) {
      try {
        results.push(await this.getQuote(s))
      } catch { /* skip failed symbols */ }
    }
    return results
  }

  // ── getHistorical — not used (Yahoo handles this) ─────────
  async getHistorical(_s: string, _f: Date, _t: Date): Promise<Candle[]> {
    throw new Error('FinnhubProvider historical not implemented. Use YahooProvider.')
  }

  // ── getNews (PRIMARY for all symbols) ─────────────────────
  async getNews(symbol: string): Promise<NewsItem[]> {
    const today = new Date()
    const from  = new Date(today)
    from.setDate(from.getDate() - 7)    // last 7 days

    const fmt = (d: Date) => d.toISOString().split('T')[0]

    const raw = await get<FinnhubNewsItem[]>('/company-news', {
      symbol,
      from: fmt(from),
      to:   fmt(today),
    })

    return (raw ?? []).slice(0, 20).map(n => ({
      id:       String(n.id),
      headline: n.headline,
      summary:  n.summary,
      source:   n.source,
      url:      n.url,
      image:    n.image || undefined,
      datetime: new Date(n.datetime * 1000).toISOString(),
      related:  n.related ? n.related.split(',').map(s => s.trim()) : [symbol],
    }))
  }
}

// Singleton export
export const finnhubProvider = new FinnhubProvider()
