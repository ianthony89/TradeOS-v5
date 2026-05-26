// ============================================================
//  TradeOS v5 — Market Data Cache (Upstash Redis)
//  Split TTL per data type — CTO spec
// ============================================================

import { Redis } from '@upstash/redis'
import type { Quote, Candle, NewsItem } from './types'

// ── TTL constants (seconds) ───────────────────────────────────
export const TTL = {
  QUOTE:      5  * 60,          //  5 min  — portfolio values must be fresh
  NEWS:       15 * 60,          // 15 min  — news updates moderately
  HISTORICAL: 12 * 60 * 60,    // 12 hr   — past candles never change
  FX:         24 * 60 * 60,    // 24 hr   — FX rates change slowly
} as const

// ── Redis client (lazy-init, safe for Edge runtime) ──────────
let _redis: Redis | null = null

function getRedis(): Redis {
  if (!_redis) {
    const url   = process.env.UPSTASH_REDIS_REST_URL
    const token = process.env.UPSTASH_REDIS_REST_TOKEN
    if (!url || !token) {
      throw new Error('[cache] UPSTASH_REDIS_REST_URL / TOKEN not configured')
    }
    _redis = new Redis({ url, token })
  }
  return _redis
}

// ── Key helpers ───────────────────────────────────────────────
const KEY = {
  quote:      (sym: string)                   => `q:${sym}`,
  quotes:     (syms: string[])                => syms.map(s => `q:${s}`),
  news:       (sym: string)                   => `news:${sym}`,
  historical: (sym: string, range: string)    => `hist:${sym}:${range}`,
  fx:         (pair: string)                  => `fx:${pair}`,
}

// ── Quote cache ───────────────────────────────────────────────
export async function getCachedQuote(symbol: string): Promise<Quote | null> {
  try {
    return await getRedis().get<Quote>(KEY.quote(symbol))
  } catch { return null }
}

export async function setCachedQuote(symbol: string, quote: Quote): Promise<void> {
  try {
    await getRedis().setex(KEY.quote(symbol), TTL.QUOTE, quote)
  } catch { /* non-fatal */ }
}

export async function getCachedQuotes(symbols: string[]): Promise<Map<string, Quote>> {
  const result = new Map<string, Quote>()
  if (!symbols.length) return result
  try {
    const keys = KEY.quotes(symbols)
    const values = await getRedis().mget<Quote[]>(...keys)
    symbols.forEach((sym, i) => {
      if (values[i]) result.set(sym, values[i]!)
    })
  } catch { /* return partial */ }
  return result
}

export async function setCachedQuotes(quotes: Quote[]): Promise<void> {
  if (!quotes.length) return
  try {
    const pipeline = getRedis().pipeline()
    for (const q of quotes) {
      pipeline.setex(KEY.quote(q.symbol), TTL.QUOTE, q)
    }
    await pipeline.exec()
  } catch { /* non-fatal */ }
}

// ── News cache ────────────────────────────────────────────────
export async function getCachedNews(symbol: string): Promise<NewsItem[] | null> {
  try {
    return await getRedis().get<NewsItem[]>(KEY.news(symbol))
  } catch { return null }
}

export async function setCachedNews(symbol: string, news: NewsItem[]): Promise<void> {
  try {
    await getRedis().setex(KEY.news(symbol), TTL.NEWS, news)
  } catch { /* non-fatal */ }
}

// ── Historical cache ──────────────────────────────────────────
export async function getCachedHistorical(
  symbol: string,
  range: string,
): Promise<Candle[] | null> {
  try {
    return await getRedis().get<Candle[]>(KEY.historical(symbol, range))
  } catch { return null }
}

export async function setCachedHistorical(
  symbol: string,
  range: string,
  candles: Candle[],
): Promise<void> {
  try {
    await getRedis().setex(KEY.historical(symbol, range), TTL.HISTORICAL, candles)
  } catch { /* non-fatal */ }
}

// ── FX cache ─────────────────────────────────────────────────
export async function getCachedFx(pair: string): Promise<number | null> {
  try {
    return await getRedis().get<number>(KEY.fx(pair))
  } catch { return null }
}

export async function setCachedFx(pair: string, rate: number): Promise<void> {
  try {
    await getRedis().setex(KEY.fx(pair), TTL.FX, rate)
  } catch { /* non-fatal */ }
}
