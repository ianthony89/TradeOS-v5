// ============================================================
//  TradeOS v5 — Market State Engine
//  Full session detection for US / MY / HK.
//  Live ticking (consumers re-render via useClock).
//  No holiday calendar yet — Phase 2.
// ============================================================

export type Market = 'US' | 'MY' | 'HK'

export type MarketSession =
  | 'pre-market'
  | 'pre-open'
  | 'open'
  | 'morning'
  | 'lunch'
  | 'afternoon'
  | 'after-hours'
  | 'overnight'
  | 'closed'

export type MarketTone = 'open' | 'pre' | 'after' | 'closed'

export interface MarketState {
  market:   Market
  session:  MarketSession
  /** UI label, English. Use i18n key for translation. */
  label:    string
  labelKey: string
  /** Whether the market is currently in an active live trading session. */
  isOpen:   boolean
  /** Color tone bucket for UI. */
  tone:     MarketTone
  /** Local time in HH:MM:SS for the market's timezone. */
  clock:    string
}

/* ── Helpers ─────────────────────────────────────────────────── */

interface TzParts {
  hour:       number
  minute:     number
  second:     number
  totalMin:   number
  weekday:    string
  isWeekend:  boolean
  clock:      string
}

function getTzParts(tz: string, hour12: boolean): TzParts {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone:  tz,
    weekday:   'short',
    hour:      'numeric',
    minute:    'numeric',
    second:    'numeric',
    hour12:    false,    // use 24h for math, format for display below
  })
  const parts = fmt.formatToParts(new Date())
  const weekday = parts.find(p => p.type === 'weekday')?.value ?? ''
  const hour    = parseInt(parts.find(p => p.type === 'hour')?.value   ?? '0', 10)
  const minute  = parseInt(parts.find(p => p.type === 'minute')?.value ?? '0', 10)
  const second  = parseInt(parts.find(p => p.type === 'second')?.value ?? '0', 10)
  const totalMin = hour * 60 + minute
  const isWeekend = weekday === 'Sat' || weekday === 'Sun'

  const clock = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12,
  }).format(new Date())

  return { hour, minute, second, totalMin, weekday, isWeekend, clock }
}

/* ── US session engine ───────────────────────────────────────── */
function getUSState(): MarketState {
  const p = getTzParts('America/New_York', true)
  const base = { market: 'US' as const, clock: p.clock }

  if (p.isWeekend) {
    return { ...base, session: 'closed', label: 'Closed', labelKey: 'market_closed', isOpen: false, tone: 'closed' }
  }

  // Pre 04:00 – 09:30
  if (p.totalMin >= 240 && p.totalMin < 570) {
    return { ...base, session: 'pre-market', label: 'Pre-market', labelKey: 'market_pre_market', isOpen: false, tone: 'pre' }
  }
  // Regular 09:30 – 16:00
  if (p.totalMin >= 570 && p.totalMin < 960) {
    return { ...base, session: 'open', label: 'Regular Hours', labelKey: 'market_regular', isOpen: true, tone: 'open' }
  }
  // Post-market 16:00 – 20:00
  if (p.totalMin >= 960 && p.totalMin < 1200) {
    return { ...base, session: 'after-hours', label: 'Post-market', labelKey: 'market_after_hours', isOpen: false, tone: 'after' }
  }
  // Friday after 20:00 → no session until Monday; it's the weekend already.
  if (p.weekday === 'Fri' && p.totalMin >= 1200) {
    return { ...base, session: 'closed', label: 'Closed', labelKey: 'market_closed', isOpen: false, tone: 'closed' }
  }
  // Overnight 00:00–04:00 + 20:00–24:00 (Mon–Thu only reaches here in the evening)
  return { ...base, session: 'overnight', label: 'Overnight', labelKey: 'market_overnight', isOpen: false, tone: 'closed' }
}

/* ── MY (Bursa) session engine ───────────────────────────────── */
function getMYState(): MarketState {
  const p = getTzParts('Asia/Kuala_Lumpur', false)
  const base = { market: 'MY' as const, clock: p.clock }

  if (p.isWeekend) {
    return { ...base, session: 'closed', label: 'Closed', labelKey: 'market_closed', isOpen: false, tone: 'closed' }
  }

  // Pre-open 08:30 – 09:00 (theoretical opening price)
  if (p.totalMin >= 510 && p.totalMin < 540) {
    return { ...base, session: 'pre-open', label: 'Pre-open', labelKey: 'market_pre_open', isOpen: false, tone: 'pre' }
  }
  // Morning session 09:00 – 12:30
  if (p.totalMin >= 540 && p.totalMin < 750) {
    return { ...base, session: 'morning', label: 'Morning', labelKey: 'market_morning', isOpen: true, tone: 'open' }
  }
  // Lunch 12:30 – 14:30
  if (p.totalMin >= 750 && p.totalMin < 870) {
    return { ...base, session: 'lunch', label: 'Lunch break', labelKey: 'market_lunch', isOpen: false, tone: 'closed' }
  }
  // Afternoon session 14:30 – 17:00
  if (p.totalMin >= 870 && p.totalMin < 1020) {
    return { ...base, session: 'afternoon', label: 'Afternoon', labelKey: 'market_afternoon', isOpen: true, tone: 'open' }
  }
  return { ...base, session: 'closed', label: 'Closed', labelKey: 'market_closed', isOpen: false, tone: 'closed' }
}

/* ── HK (HKEX) session engine — optional ─────────────────────── */
function getHKState(): MarketState {
  const p = getTzParts('Asia/Hong_Kong', false)
  const base = { market: 'HK' as const, clock: p.clock }

  if (p.isWeekend) {
    return { ...base, session: 'closed', label: 'Closed', labelKey: 'market_closed', isOpen: false, tone: 'closed' }
  }
  // Morning 09:30 – 12:00, Afternoon 13:00 – 16:00, Lunch 12:00 – 13:00
  if ((p.totalMin >= 570 && p.totalMin < 720) || (p.totalMin >= 780 && p.totalMin < 960)) {
    return { ...base, session: 'open', label: 'Open', labelKey: 'market_open', isOpen: true, tone: 'open' }
  }
  if (p.totalMin >= 720 && p.totalMin < 780) {
    return { ...base, session: 'lunch', label: 'Lunch break', labelKey: 'market_lunch', isOpen: false, tone: 'closed' }
  }
  return { ...base, session: 'closed', label: 'Closed', labelKey: 'market_closed', isOpen: false, tone: 'closed' }
}

export function getMarketState(market: Market): MarketState {
  switch (market) {
    case 'US': return getUSState()
    case 'MY': return getMYState()
    case 'HK': return getHKState()
  }
}
