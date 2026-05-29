// ============================================================
//  TradeOS v5 — Number / Currency / Percentage Formatters
//  Single source of truth. All UI numbers go through here.
// ============================================================

const usdFmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const myrFmt = new Intl.NumberFormat('en-MY', {
  style: 'currency',
  currency: 'MYR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const usdCompactFmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 1,
})

const myrCompactFmt = new Intl.NumberFormat('en-MY', {
  style: 'currency',
  currency: 'MYR',
  notation: 'compact',
  maximumFractionDigits: 1,
})

const intFmt   = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
const decFmt   = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Coerce maybe-null to safe number. */
function n(v: number | null | undefined): number {
  return Number.isFinite(v as number) ? (v as number) : 0
}

/** USD/MYR money formatter — chooses by currency code. */
function money(value: number | null | undefined, currency = 'USD'): string {
  const v = n(value)
  if (currency === 'MYR') return myrFmt.format(v)
  return usdFmt.format(v)
}

/** Compact ($1.2K, $3.4M) — chooses by currency code. */
function compact(value: number | null | undefined, currency = 'USD'): string {
  const v = n(value)
  if (currency === 'MYR') return myrCompactFmt.format(v)
  return usdCompactFmt.format(v)
}

/** Percentage. Pass already-percent values (e.g. 1.79 for 1.79%). */
function pct(value: number | null | undefined, digits = 2): string {
  return `${n(value).toFixed(digits)}%`
}

/** Signed percentage with explicit +/- sign. */
function pctSigned(value: number | null | undefined, digits = 2): string {
  const v = n(value)
  return `${v >= 0 ? '+' : ''}${v.toFixed(digits)}%`
}

/** Signed number with explicit +/- sign and fixed digits. */
function signed(value: number | null | undefined, digits = 2): string {
  const v = n(value)
  return `${v >= 0 ? '+' : ''}${v.toFixed(digits)}`
}

/** Signed money — e.g. +$234.50 / -$1,234.00 */
function moneySigned(value: number | null | undefined, currency = 'USD'): string {
  const v = n(value)
  const formatted = money(Math.abs(v), currency)
  return v >= 0 ? `+${formatted}` : `-${formatted}`
}

/** Plain integer with thousands separators. */
function int(value: number | null | undefined): string {
  return intFmt.format(n(value))
}

/** Decimal number with thousands separators. */
function dec(value: number | null | undefined, digits = 2): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n(value))
}

/** Price formatter — auto picks digits based on magnitude. */
function price(value: number | null | undefined): string {
  const v = n(value)
  const abs = Math.abs(v)
  if (abs >= 1000) return dec(v, 2)
  if (abs >= 1)    return dec(v, 2)
  if (abs >= 0.01) return dec(v, 4)
  return dec(v, 6)
}

/** Quantity / share count — strips trailing zeros for clean display. */
function qty(value: number | null | undefined): string {
  const v = n(value)
  if (Number.isInteger(v)) return intFmt.format(v)
  return decFmt.format(v).replace(/\.?0+$/, '')
}

/** "5 minutes ago" / "2 hours ago" — for last-updated timestamps. */
function relativeTime(input: string | Date | null | undefined): string {
  if (!input) return ''
  const d = typeof input === 'string' ? new Date(input) : input
  const diff = Date.now() - d.getTime()
  if (diff < 60_000)        return 'just now'
  if (diff < 3_600_000)     return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000)    return `${Math.floor(diff / 3_600_000)}h ago`
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/** FX rate display — strips trailing zeros, keeps at least 1 decimal.
 *  4 → "4.0",  4.05 → "4.05",  4.1234 → "4.1234"
 */
function fxRate(rate: number | null | undefined): string {
  const v = n(rate)
  if (v <= 0) return '0.0'
  let s = v.toFixed(4).replace(/0+$/, '')
  if (s.endsWith('.')) s += '0'
  return s
}

export const fmt = {
  money,
  compact,
  pct,
  pctSigned,
  signed,
  moneySigned,
  int,
  dec,
  price,
  qty,
  fxRate,
  relativeTime,
}
