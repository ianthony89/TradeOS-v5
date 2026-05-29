// ============================================================
//  TradeOS v5 — Asset Type Detection
// ============================================================

import type { AssetType } from './types'

/**
 * Detect asset type from a NORMALIZED symbol.
 * Pass yahoo quoteType when available for runtime override.
 */
export function detectAssetType(
  normalizedSymbol: string,
  yahooQuoteType?: string,
): AssetType {
  // Runtime override from Yahoo quoteType — most accurate
  if (yahooQuoteType) {
    const qt = yahooQuoteType.toUpperCase()
    if (qt === 'ETF')            return 'ETF'
    if (qt === 'MUTUALFUND')     return 'ETF'
    if (qt === 'CRYPTOCURRENCY') return 'CRYPTO'
    if (qt === 'INDEX')          return 'INDEX'
    if (qt === 'EQUITY')         /* fall through to symbol-based */ {}
  }

  // Index symbols start with ^
  if (normalizedSymbol.startsWith('^')) return 'INDEX'

  // Malaysian Bursa symbols end with .KL
  if (normalizedSymbol.endsWith('.KL')) return 'MY_EQUITY'

  // Hong Kong / Shanghai / Shenzhen
  if (normalizedSymbol.endsWith('.HK')) return 'US_EQUITY'  // treat as equity for routing
  if (normalizedSymbol.endsWith('.SS')) return 'US_EQUITY'
  if (normalizedSymbol.endsWith('.SZ')) return 'US_EQUITY'

  // Crypto — common base symbols
  if (/^(BTC|ETH|SOL|BNB|XRP|ADA|DOGE|AVAX|DOT|LINK|MATIC)-USD$/.test(normalizedSymbol)) {
    return 'CRYPTO'
  }

  // Well-known ETFs (extend list as needed)
  const KNOWN_ETFS = new Set([
    'SPY','QQQ','IWM','DIA','GLD','SLV','TLT','HYG','LQD',
    'VTI','VOO','ARKK','SOXL','TQQQ','SQQQ','UVXY','VXX',
    'XLF','XLK','XLE','XLV','XLI','XLP','XLU','XLB','XLC',
    // Leveraged ETFs from user's portfolio
    'CBRG','CRCG','FBL','NOWL',
  ])
  if (KNOWN_ETFS.has(normalizedSymbol)) return 'ETF'

  return 'US_EQUITY'
}
