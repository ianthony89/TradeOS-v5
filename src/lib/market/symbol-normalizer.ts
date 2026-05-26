// ============================================================
//  TradeOS v5 — Symbol Normalizer
//  Converts raw broker symbols → Yahoo Finance-compatible symbols
// ============================================================

export class SymbolNormalizationError extends Error {
  constructor(symbol: string, reason: string) {
    super(`Cannot normalize symbol "${symbol}": ${reason}`)
    this.name = 'SymbolNormalizationError'
  }
}

/**
 * Normalize a raw broker symbol to a Yahoo Finance-compatible symbol.
 *
 * @param raw       Raw symbol from CSV (e.g. "5555", "AAPL", "BTC")
 * @param currency  Currency from CSV row (e.g. "MYR", "USD", "HKD")
 * @param exchange  Exchange hint if available (e.g. "Bursa Malaysia", "HKEX")
 */
export function normalizeSymbol(
  raw: string,
  currency?: string,
  exchange?: string,
): string {
  const s = raw.trim().toUpperCase()

  // ── Exchange metadata (most explicit signal) ──────────────
  if (exchange) {
    const ex = exchange.toLowerCase()
    if (ex.includes('bursa'))       return `${s}.KL`
    if (ex.includes('hkex') ||
        ex.includes('hong kong'))   return `${s}.HK`
    if (ex.includes('shanghai'))    return `${s}.SS`
    if (ex.includes('shenzhen'))    return `${s}.SZ`
  }

  // ── Currency as reliable secondary signal ─────────────────
  if (currency) {
    const cur = currency.toUpperCase()
    if (cur === 'MYR') return `${s}.KL`
    if (cur === 'HKD') return `${s}.HK`
    if (cur === 'CNH' || cur === 'CNY') return `${s}.SS`
  }

  // ── Crypto ────────────────────────────────────────────────
  const CRYPTO_BASES = ['BTC','ETH','SOL','BNB','XRP','ADA','DOGE','AVAX','DOT','LINK','MATIC']
  if (CRYPTO_BASES.includes(s)) return `${s}-USD`
  // Already in Yahoo crypto format
  if (/^[A-Z]+-USD$/.test(s)) return s

  // ── Index symbols ─────────────────────────────────────────
  if (s.startsWith('^')) return s

  // ── Numeric-only without metadata — DANGEROUS, do not guess ──
  if (/^\d+$/.test(s)) {
    throw new SymbolNormalizationError(
      raw,
      'numeric symbol requires currency or exchange metadata to determine market (MY/HK/etc.)'
    )
  }

  // ── Default: US / international symbol ────────────────────
  return s
}

/**
 * Batch normalize — returns { normalized, error } per symbol.
 * Never throws; errors are captured per item.
 */
export function normalizeSymbols(
  items: Array<{ symbol: string; currency?: string; exchange?: string }>
): Array<{ raw: string; normalized: string | null; error: string | null }> {
  return items.map(({ symbol, currency, exchange }) => {
    try {
      return { raw: symbol, normalized: normalizeSymbol(symbol, currency, exchange), error: null }
    } catch (e) {
      return { raw: symbol, normalized: null, error: (e as Error).message }
    }
  })
}
