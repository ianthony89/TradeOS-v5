// ============================================================
//  TradeOS v5 — Stock Logo URL Provider (MVP)
//  Strategy: Parqet public CDN → letter avatar fallback.
//  No Clearbit map, no API key required.
// ============================================================

/**
 * Decide if a Parqet logo lookup is worthwhile for this ticker.
 * Skip lookup (go straight to letter avatar) for:
 *   - Numeric-only symbols (Bursa Malaysia, e.g. "5555")
 *   - Symbols with non-US suffixes (.KL, .HK, .SI, .SS, .SZ, .T, .L, ...)
 *   - Empty / unknown symbols
 *
 * For everything else (US equities, ETFs, crypto-USD pairs, .US), try Parqet.
 */
export function parqetLogoUrl(symbol: string): string | null {
  const s = (symbol ?? '').trim().toUpperCase()
  if (!s) return null

  // Pure numeric → no logo (Bursa raw)
  if (/^\d+$/.test(s)) return null

  // Strip any normalised suffix to test the base
  const base = s.replace(/\.[A-Z]+$/, '')
  if (!base) return null

  // Non-US exchange suffixes → skip CDN
  if (/\.(KL|HK|SS|SZ|SI|T|L|TO|V|AX|F|DE|PA|MX|SA|BO|NS)$/.test(s)) return null

  // Crypto pairs (BTC-USD, ETH-USD) — Parqet handles some of these
  return `https://assets.parqet.com/logos/symbol/${encodeURIComponent(s)}?format=png`
}

/**
 * Compute 1–3 character initials for the letter avatar fallback.
 * Numeric tickers use first 4 digits (e.g. "5555" → "5555").
 */
export function logoInitials(symbol: string): string {
  const s = (symbol ?? '').trim().toUpperCase().replace(/\.[A-Z]+$/, '')
  if (!s) return '?'
  if (/^\d+$/.test(s)) return s.slice(0, 4)
  // Strip any USD/-USD suffix for crypto
  const clean = s.replace(/[-_]USD$/, '')
  return clean.slice(0, 2)
}

/**
 * Deterministic colour bucket from ticker — picks one of 6 refined gradients.
 * No neon, no clown palette — premium fintech tones only.
 */
const AVATAR_GRADIENTS = [
  'linear-gradient(135deg, #3d8bff 0%, #6366f1 100%)',   // blue → indigo
  'linear-gradient(135deg, #8b6dff 0%, #a78bfa 100%)',   // purple → light purple
  'linear-gradient(135deg, #10b981 0%, #14b8a6 100%)',   // emerald → teal
  'linear-gradient(135deg, #f59e0b 0%, #f97316 100%)',   // amber → orange
  'linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)',   // pink → rose
  'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)',   // cyan → blue
] as const

export function avatarGradient(symbol: string): string {
  const s = (symbol ?? '').toUpperCase()
  let hash = 0
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0
  }
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length]
}
