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

const usdCompactFmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 1,
})

// MYR is rendered with an explicit "MYR" prefix (not the "RM" Intl symbol).
const compactNum = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 })

const intFmt   = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
const decFmt   = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Coerce maybe-null to safe number. */
function n(v: number | null | undefined): number {
  return Number.isFinite(v as number) ? (v as number) : 0
}

/** USD/MYR money formatter — chooses by currency code.
 *  MYR uses an explicit "MYR" prefix (e.g. "MYR 18,668.44"), not "RM". */
function money(value: number | null | undefined, currency = 'USD'): string {
  const v = n(value)
  if (currency === 'MYR') return `MYR ${decFmt.format(v)}`
  return usdFmt.format(v)
}

/** Compact ($1.2K, MYR 18.7K) — chooses by currency code. */
function compact(value: number | null | undefined, currency = 'USD'): string {
  const v = n(value)
  if (currency === 'MYR') return `MYR ${compactNum.format(v)}`
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

/** "5m ago" / "刚刚" — for last-updated timestamps. Localized. */
function relativeTime(input: string | Date | null | undefined, lang: 'en' | 'zh' = 'en'): string {
  if (!input) return ''
  const d = typeof input === 'string' ? new Date(input) : input
  const diff = Date.now() - d.getTime()
  const min  = Math.floor(diff / 60_000)
  const hr   = Math.floor(diff / 3_600_000)
  const day  = Math.floor(diff / 86_400_000)
  if (lang === 'zh') {
    if (diff < 60_000)         return '刚刚'
    if (diff < 3_600_000)      return `${min} 分钟前`
    if (diff < 86_400_000)     return `${hr} 小时前`
    if (diff < 7 * 86_400_000) return `${day} 天前`
    return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
  }
  if (diff < 60_000)         return 'just now'
  if (diff < 3_600_000)      return `${min}m ago`
  if (diff < 86_400_000)     return `${hr}h ago`
  if (diff < 7 * 86_400_000) return `${day}d ago`
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
