'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { RefreshCw, Upload, TrendingUp, Wallet, Coins, BadgeDollarSign, Repeat, X, ArrowRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useHoldingsStore, type Holding } from '@/stores/holdings'
import { useMarketStore, selectActiveFxRate } from '@/stores/market'
import { useI18n }        from '@/lib/i18n/context'
import { fmt }            from '@/lib/utils/format'
import { HOT_LIST }       from '@/lib/market/hot-list'
import { Panel, PanelHead, PanelBody } from '@/components/ui/panel'
import { StatCard }       from '@/components/ui/stat-card'
import { DeltaBadge }     from '@/components/ui/delta-badge'
import { EmptyState }     from '@/components/ui/empty-state'
import { ImportCsvButton } from '@/components/ui/import-button'
import { Toast, type ToastData } from '@/components/ui/toast'
import { TickerStrip }    from '@/components/ui/ticker-strip'
import { type DonutSlice } from '@/components/ui/donut-chart'
import { AllocationViews, ALLOC_VIEWS, nextAllocView, type AllocView } from '@/components/ui/allocation-views'
import { PlHistogram }     from '@/components/ui/histogram-chart'
import { SymCell }        from '@/components/brand/stock-logo'
import { getSector, getSectorColor, sectorKey } from '@/lib/portfolio/sectors'
import { stockName }      from '@/lib/portfolio/stock-names'
import { classifyStrategy, classifyAction, ACTION_TONE } from '@/lib/portfolio/taxonomy'
import { reviewStatus } from '@/lib/portfolio/review-status'
import { loadAllPositionIntel } from '@/lib/portfolio/position-intel'
import { computeRiskScore } from '@/lib/portfolio/risk-score'

/** USD-equivalent of a native amount (MYR ÷ FX). Module-scope = stable. */
function usdEquiv(amt: number, currency: string, fx: number): number {
  const r = fx > 0 ? fx : 4   // guard: never divide by a zero/blank FX
  return currency === 'MYR' ? amt / r : amt
}

function positionTotalReturnPct(h: Pick<Holding, 'avgCost' | 'quantity' | 'unrealizedPl' | 'realizedPl'>): number {
  const cost = h.avgCost * h.quantity
  return cost > 0 ? ((h.unrealizedPl + h.realizedPl) / cost) * 100 : 0
}

function todayMovePct(h: Pick<Holding, 'marketValue' | 'todayPl'>): number {
  const prev = h.marketValue - h.todayPl
  return prev > 0 ? (h.todayPl / prev) * 100 : 0
}

function formatDashAmount(value: number, compact = false): string {
  return new Intl.NumberFormat('en-US', compact
    ? { notation: 'compact', maximumFractionDigits: 1 }
    : { minimumFractionDigits: 2, maximumFractionDigits: 2 }
  ).format(Math.abs(value))
}

function DashMoney({
  value,
  currency,
  signed = false,
  compact = false,
  className = '',
}: {
  value: number
  currency: 'USD' | 'MYR'
  signed?: boolean
  compact?: boolean
  className?: string
}) {
  const sign = signed ? (value > 0 ? '+' : value < 0 ? '-' : '') : ''
  return (
    <span className={`dash-money ${className}`.trim()}>
      <span className="dash-money-main">{sign}{formatDashAmount(value, compact)}</span>
      <span className="dash-money-code">{currency}</span>
    </span>
  )
}

/* Review Queue dismiss — local only (no backend), hidden for 7 days. */
const DISMISS_KEY = 'tradeos-dash-dismiss'
const DISMISS_MS  = 7 * 24 * 60 * 60 * 1000
function loadDismissed(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(DISMISS_KEY) || '{}') } catch { return {} }
}

type ReviewType = 'EXIT' | 'REDUCE' | 'REVIEW' | 'WATCH'
interface ReviewItem {
  symbol: string; symbolNormalized: string; name: string; currency: string
  type: ReviewType; rank: number; unrealizedPlPct: number; portfolioWeight: number
  reviewDays: number | null   // negative = days overdue (for the 2nd fact line)
}

type RiskLevel = 'low' | 'moderate' | 'high'

/** Split an i18n template ("{sym} accounts for {pct}…") into JSX with the
 *  placeholders emphasised — keeps Risk drivers reading like sentences (not
 *  a table) while letting the key numbers pop. */
function fillTmpl(tmpl: string, vals: Record<string, string>) {
  return tmpl.split(/(\{[a-z]+\})/g).map((part, i) => {
    const m = /^\{([a-z]+)\}$/.exec(part)
    return m
      ? <strong key={i} className="riskd-em">{vals[m[1]] ?? ''}</strong>
      : <span key={i}>{part}</span>
  })
}

export default function DashboardPage() {
  const { t, lang } = useI18n()
  const supabase = useMemo(() => createClient(), [])
  const router   = useRouter()
  const {
    holdings, setHoldings,
    quotes, updateQuotes,
    quoteRefreshing, setRefreshing,
  } = useHoldingsStore()
  const fxRate             = useMarketStore(selectActiveFxRate)
  const setQuotesUpdated   = useMarketStore(s => s.setQuotesUpdated)
  const primaryCurrency    = useMarketStore(s => s.primaryCurrency)
  const setPrimaryCurrency = useMarketStore(s => s.setPrimaryCurrency)

  /* Curated Hot List (live prices) for the top ticker row */
  const [hotItems, setHotItems] = useState<Array<{ symbol: string; price: number; changePct: number; currency: string }>>([])
  const [toast, setToast] = useState<ToastData | null>(null)
  const [allocView, setAllocView] = useState<AllocView>('donut')

  /* Per-position intelligence (review schedule) for the Review Queue */
  const [intelMap, setIntelMap] = useState<Map<string, import('@/lib/portfolio/position-intel').PositionIntel>>(new Map())
  const [dismissed, setDismissed] = useState<Record<string, number>>({})   // Action Center dismiss (7d, localStorage)
  const [closedCount, setClosedCount] = useState(0)                        // exited positions — shown in the hero (v5.1)
  const holdingsRef = useRef<typeof holdings>([])
  const refreshingRef = useRef(false)

  useEffect(() => {
    holdingsRef.current = holdings
  }, [holdings])

  /* Reusable holdings loader (also called after a dashboard import).
     Returns the freshly loaded rows so callers can summarize them. */
  const loadHoldings = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []
    const { data } = await supabase
      .from('holdings')
      .select('*')
      .eq('user_id', user.id)
      .order('market_value', { ascending: false })
    if (data) {
      const mapped = data.map(row => ({
        id:               row.id,
        symbol:           row.symbol,
        symbolNormalized: row.symbol_normalized,
        name:             row.name ?? row.symbol,
        quantity:         Number(row.quantity),
        availableQty:     Number(row.available_qty ?? row.quantity),
        avgCost:          Number(row.avg_cost),
        currentPrice:     Number(row.current_price ?? row.avg_cost),
        marketValue:      Number(row.market_value ?? 0),
        unrealizedPl:     Number(row.unrealized_pl ?? 0),
        unrealizedPlPct:  Number(row.unrealized_pl_pct ?? 0),
        realizedPl:       Number(row.realized_pl ?? 0),
        todayPl:          Number(row.today_pl ?? 0),
        currency:         row.currency,
        assetType:        row.asset_type ?? 'US_EQUITY',
        sector:           row.sector,
        targetPrice:      row.target_price ? Number(row.target_price) : null,
        stopLoss:         row.stop_loss ? Number(row.stop_loss) : null,
        notes:            row.notes,
        portfolioWeight:  0,
        quotesUpdatedAt:  row.quotes_updated_at,
      }))
      // v5.0.6 P0: the Dashboard uses OPEN positions only. Closed positions
      // (quantity 0, exited via close-in-place) must never enter any ranking,
      // calculation, mover, risk factor or attention item. Filtering here is the
      // single choke point — every downstream metric derives from this set.
      const open = mapped.filter(m => m.quantity > 0)
      setHoldings(open)
      setClosedCount(mapped.length - open.length)
      return open
    }
    return []
  }, [supabase, setHoldings])

  // loadHoldings is async — every setState runs after an await, not synchronously.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadHoldings() }, [loadHoldings])

  /* Attention Layer data — all position intel + watchlist triggers.
     Reuses Phase 2A rows (no new tables). Quotes for watched symbols are
     fetched once so we can compute TRIGGERED. Graceful if intel is empty
     (migration 007 not applied yet) — feed falls back to price + watchlist. */
  useEffect(() => {
    let alive = true
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !alive) return

      const im = await loadAllPositionIntel(supabase, user.id)
      if (alive) { setIntelMap(im); setDismissed(loadDismissed()) }
    })()
    return () => { alive = false }
  }, [supabase])

  /* Fetch the Hot List once on mount (prices are live) for the top row */
  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const res  = await fetch('/api/quotes', {
          method:  'POST',
          headers: { 'content-type': 'application/json' },
          body:    JSON.stringify({ symbols: HOT_LIST }),
        })
        const json = await res.json()
        if (active && json.quotes) {
          setHotItems((json.quotes as Array<{ symbol: string; price: number; changePercent: number }>).map(q => ({
            symbol:    q.symbol,
            price:     q.price,
            changePct: q.changePercent ?? 0,
            currency:  'USD',
          })))
        }
      } catch { /* ignore */ }
    })()
    return () => { active = false }
  }, [])

  /* Refresh quotes — also stamps the sync indicator */
  const refreshQuotes = useCallback(async (rows?: typeof holdings) => {
    const target = rows ?? holdingsRef.current
    if (!target.length || refreshingRef.current) return
    refreshingRef.current = true
    setRefreshing(true)
    try {
      const symbols = target.map(h => h.symbolNormalized)
      const res  = await fetch('/api/quotes', {
        method:  'POST',
        headers: { 'content-type': 'application/json' },
        body:    JSON.stringify({ symbols, skipCache: true }),
      })
      const json = await res.json()
      if (json.quotes) {
        updateQuotes(json.quotes)
        setQuotesUpdated(new Date())
      }
    } catch { /* swallow */ }
    finally {
      refreshingRef.current = false
      setRefreshing(false)
    }
  }, [setRefreshing, updateQuotes, setQuotesUpdated])

  useEffect(() => {
    if (!holdings.length) return
    refreshQuotes(holdings)
    const id = setInterval(() => refreshQuotes(), 30 * 60 * 1000)
    return () => clearInterval(id)
  }, [holdings, refreshQuotes])

  /* ── Live recompute layer (the fix for "Refresh doesn't move numbers") ──
     When a fresh quote exists for a holding, recompute its monetary fields
     from the live price instead of trusting the CSV snapshot. Everything
     downstream (totals, movers, sectors, risk, ticker) derives from `live`,
     so pressing Refresh Quotes updates the whole dashboard — no re-import,
     no DB write, no page reload. Holdings without a quote keep their snapshot. */
  const live = useMemo(() =>
    holdings.map(h => {
      const q = quotes.get(h.symbolNormalized)
      if (!q || !(q.price > 0)) return h
      const price           = q.price
      const qty             = h.quantity
      const marketValue     = price * qty
      const unrealizedPl    = (price - h.avgCost) * qty
      const unrealizedPlPct = h.avgCost > 0 ? ((price - h.avgCost) / h.avgCost) * 100 : 0
      const todayPl         = (q.change ?? 0) * qty
      return { ...h, currentPrice: price, marketValue, unrealizedPl, unrealizedPlPct, todayPl }
    }),
  [holdings, quotes])

  /* ── Derived metrics (USD base → displayed in chosen currency) ───
     Every monetary metric is first reduced to a USD-equivalent base
     (MYR holdings ÷ FX), then converted to the active display currency.
     This keeps Holdings Value, Today P/L and Unrealized P/L consistent
     and makes them all switch together with the currency toggle. */
  const { combined, todayPlUsd, unrealizedUsd, realizedUsd } = useMemo(() => {
    let c = 0, t = 0, u = 0, r = 0
    for (const h of live) {
      c += usdEquiv(h.marketValue,  h.currency, fxRate)
      t += usdEquiv(h.todayPl,      h.currency, fxRate)
      u += usdEquiv(h.unrealizedPl, h.currency, fxRate)
      r += usdEquiv(h.realizedPl,   h.currency, fxRate)
    }
    return { combined: c, todayPlUsd: t, unrealizedUsd: u, realizedUsd: r }
  }, [live, fxRate])
  const costUsd = combined - unrealizedUsd

  const toDisplay = (usd: number) => (primaryCurrency === 'USD' ? usd : usd * fxRate)

  const todayPct      = combined > 0 ? (todayPlUsd / combined) * 100 : 0
  const totalPlUsd    = unrealizedUsd + realizedUsd
  const totalReturnPct = costUsd > 0 ? (totalPlUsd / costUsd) * 100 : 0
  const todayTone     = todayPlUsd > 0 ? 'positive' : todayPlUsd < 0 ? 'negative' : 'neutral'

  /* Hero — primary value + converted secondary */
  const heroPrimaryValue   = toDisplay(combined)
  const heroSecondaryValue = primaryCurrency === 'USD' ? combined * fxRate : combined
  const heroSecondaryCurr  = primaryCurrency === 'USD' ? 'MYR' : 'USD'

  /* Weight in USD-equivalent terms */
  const withWeight = useMemo(() =>
    live.map(h => {
      const usdValue = h.currency === 'MYR' ? h.marketValue / (fxRate > 0 ? fxRate : 4) : h.marketValue
      return {
        ...h,
        usdValue,
        portfolioWeight: combined > 0 ? (usdValue / combined) * 100 : 0,
      }
    }),
  [live, combined, fxRate])

  /* Top positions — top 6 by weight */
  const topPositions = useMemo(() =>
    [...withWeight].sort((a, b) => b.portfolioWeight - a.portfolioWeight).slice(0, 6),
  [withWeight])

  /* Today's movers — best & worst by TODAY's % change (penny-filtered) */
  const { todayWinner, todayLoser } = useMemo(() => {
    const eligible = withWeight.filter(h => h.usdValue >= 100 || h.portfolioWeight >= 1)
    if (!eligible.length) return { todayWinner: undefined, todayLoser: undefined }
    const scored = eligible.map(h => {
      const prev = h.marketValue - h.todayPl
      return { ...h, todayPct: prev > 0 ? (h.todayPl / prev) * 100 : 0 }
    })
    const sorted = [...scored].sort((a, b) => b.todayPct - a.todayPct)
    return { todayWinner: sorted[0], todayLoser: sorted[sorted.length - 1] }
  }, [withWeight])

  /* Sector donut slices */
  const sectorSlices = useMemo<DonutSlice[]>(() => {
    if (!withWeight.length || combined <= 0) return []
    const buckets = new Map<string, number>()
    for (const h of withWeight) {
      const sec = getSector(h.symbol, h.assetType)
      buckets.set(sec, (buckets.get(sec) ?? 0) + h.usdValue)
    }
    return [...buckets.entries()]
      .map(([sec, value]) => ({ name: t(sectorKey(sec)), value, pct: (value / combined) * 100, color: getSectorColor(sec) }))
      .sort((a, b) => b.pct - a.pct)
  }, [withWeight, combined, t])

  const allocationRead = useMemo(() => {
    const active = sectorSlices.filter(s => s.pct > 0).sort((a, b) => b.pct - a.pct)
    if (active.length < 2) return null

    const sumSq = active.reduce((sum, s) => sum + (s.pct / 100) ** 2, 0)
    const effective = sumSq > 0 ? 1 / sumSq : 0
    const topN = Math.min(2, active.length)
    const topWeight = active.slice(0, topN).reduce((sum, s) => sum + s.pct, 0)

    return t('alloc_insight_read', {
      eff: effective.toFixed(1),
      n: active.length,
      topN,
      pct: fmt.pct(topWeight, 1),
    })
  }, [sectorSlices, t])

  /* Ticker strip — one chip per holding */
  const tickerItems = useMemo(() =>
    live.filter(h => h.currentPrice > 0)
      .map(h => ({ symbol: h.symbol, price: h.currentPrice, changePct: todayMovePct(h), currency: h.currency })),
  [live])

  /* Hero — largest position */
  const largest = topPositions[0]

  /* Portfolio Snapshot inputs: speculative weight + deep-red (below -50%) count */
  const speculativeWeight = useMemo(() =>
    withWeight.reduce((s, h) => {
      const cls = classifyStrategy({ symbol: h.symbol, name: h.name, assetType: h.assetType, unrealizedPlPct: h.unrealizedPlPct, portfolioWeight: h.portfolioWeight })
      return cls === 'SPECULATIVE' ? s + h.portfolioWeight : s
    }, 0),
  [withWeight])
  const brokenCount = withWeight.filter(h => h.unrealizedPlPct < -50).length

  /* Risk Score + level (v5.1 arc gauge). Drivers are shown as plain facts —
     no "+22 / +14" impact decomposition (the owner found it noise). */
  const risk = useMemo(() => {
    const maxWeight    = Math.max(0, ...withWeight.map(h => h.portfolioWeight))
    const brokenWeight = withWeight.reduce((s, h) => h.unrealizedPlPct < -50 ? s + h.portfolioWeight : s, 0)
    return { ...computeRiskScore({ maxWeight, speculativeWeight, brokenWeight }), maxWeight }
  }, [withWeight, speculativeWeight])

  /* Stars for the Starfield allocation view — one star per holding */
  const allocStars = useMemo(() =>
    withWeight.map(h => {
      const sector = getSector(h.symbol, h.assetType)
      return { symbol: h.symbol, sector: t(sectorKey(sector)), weight: h.portfolioWeight, color: getSectorColor(sector) }
    }),
  [withWeight, t])

  /* Portfolio Health — win rate + average & extreme returns (v5.1) */
  const health = useMemo(() => {
    const gains  = withWeight.filter(h => h.unrealizedPlPct > 0).map(h => h.unrealizedPlPct)
    const losses = withWeight.filter(h => h.unrealizedPlPct < 0).map(h => h.unrealizedPlPct)
    const mean   = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0)
    const decided = gains.length + losses.length
    return {
      winRate:     decided ? (gains.length / decided) * 100 : 0,
      avgGain:     mean(gains),
      avgLoss:     mean(losses),
      largestGain: gains.length  ? Math.max(...gains)  : 0,
      largestLoss: losses.length ? Math.min(...losses) : 0,
    }
  }, [withWeight])

  /* My Holdings — full simplified list (v5.1): weight · value · total return ·
     today's move · action. Sorted by weight; each row links to the Hub. */
  const holdingsFull = useMemo(() =>
    [...withWeight]
      .sort((a, b) => b.portfolioWeight - a.portfolioWeight)
      .map(h => {
        return {
          ...h,
          totalReturnPct: positionTotalReturnPct(h),
          todayPct:       todayMovePct(h),
          action: classifyAction({ symbol: h.symbol, name: h.name, assetType: h.assetType, unrealizedPlPct: h.unrealizedPlPct, portfolioWeight: h.portfolioWeight }),
        }
      }),
  [withWeight])

  /* Winners & Losers board — top 3 / bottom 3 by total return % */
  const board = useMemo(() => {
    const sorted = withWeight
      .map(h => ({ ...h, totalReturnPct: positionTotalReturnPct(h) }))
      .sort((a, b) => b.totalReturnPct - a.totalReturnPct)
    return {
      winners: sorted.filter(h => h.totalReturnPct > 0).slice(0, 3),
      losers:  sorted.filter(h => h.totalReturnPct < 0).slice(-3).reverse(),
    }
  }, [withWeight])

  /* P/L distribution summary counts (shown above the histogram) */
  const plSummary = useMemo(() => {
    let green = 0, red = 0, bigWin = 0, bigLose = 0
    for (const h of withWeight) {
      if (h.unrealizedPlPct > 0) green++; else if (h.unrealizedPlPct < 0) red++
      if (h.unrealizedPlPct > 50) bigWin++
      if (h.unrealizedPlPct < -50) bigLose++
    }
    return { green, red, bigWin, bigLose }
  }, [withWeight])

  /* Review Queue — typed action items with a 7-day dismiss (v5.0.8). No
     sentence generation: just EXIT / REDUCE / REVIEW + a one-line reason. */
  const reviewQueue = useMemo<ReviewItem[]>(() => {
    // 7-day dismiss expiry — coarse, so a render-time clock read is deliberate.
    // eslint-disable-next-line react-hooks/purity
    const now = Date.now()
    const out: ReviewItem[] = []
    for (const h of withWeight) {
      if ((dismissed[h.symbolNormalized] ?? 0) > now) continue
      const action = classifyAction({ symbol: h.symbol, name: h.name, assetType: h.assetType, unrealizedPlPct: h.unrealizedPlPct, portfolioWeight: h.portfolioWeight })
      const rs = reviewStatus(intelMap.get(h.symbolNormalized)?.nextReviewAt ?? null)
      let type: ReviewType, rank: number
      if (action === 'EXIT')                                          { type = 'EXIT';   rank = 0 }
      else if (action === 'REDUCE')                                   { type = 'REDUCE'; rank = 1 }
      else if (rs && (rs.state === 'overdue' || rs.state === 'due'))  { type = 'REVIEW'; rank = 2 }
      else if (h.portfolioWeight >= 20)                               { type = 'WATCH';  rank = 3 }
      else continue
      out.push({ symbol: h.symbol, symbolNormalized: h.symbolNormalized, name: h.name, currency: h.currency, type, rank, unrealizedPlPct: h.unrealizedPlPct, portfolioWeight: h.portfolioWeight, reviewDays: rs?.days ?? null })
    }
    // Sort by URGENCY only (EXIT→REDUCE→REVIEW→WATCH). withWeight is already
    // market-value desc, and sort is stable, so within a tier the biggest
    // holding comes first — never by drawdown / symbol / date.
    return out.sort((a, b) => a.rank - b.rank).slice(0, 8)
  }, [withWeight, intelMap, dismissed])

  const actionMix = useMemo(() => {
    const mix = { total: reviewQueue.length, exit: 0, reduce: 0, review: 0, watch: 0 }
    for (const item of reviewQueue) {
      if (item.type === 'EXIT') mix.exit++
      else if (item.type === 'REDUCE') mix.reduce++
      else if (item.type === 'REVIEW') mix.review++
      else if (item.type === 'WATCH') mix.watch++
    }
    return mix
  }, [reviewQueue])

  const decisionBrief = useMemo(() => {
    if (largest && risk.maxWeight >= 25 && speculativeWeight >= 30) {
      return t('dash_brief_conc_spec', { sym: largest.symbol, weight: fmt.pct(risk.maxWeight, 0), spec: fmt.pct(speculativeWeight, 0) })
    }
    if (brokenCount >= 3) return t('dash_brief_drawdown', { n: brokenCount })
    if (largest && risk.maxWeight >= 25) return t('dash_brief_conc', { sym: largest.symbol, weight: fmt.pct(risk.maxWeight, 0) })
    if (speculativeWeight >= 30) return t('dash_brief_spec', { spec: fmt.pct(speculativeWeight, 0) })
    return t('dash_brief_stable')
  }, [largest, risk.maxWeight, speculativeWeight, brokenCount, t])

  const briefActionRead = actionMix.total
    ? [actionMix.exit ? `${actionMix.exit} ${t('rq_type_exit')}` : '', actionMix.reduce ? `${actionMix.reduce} ${t('rq_type_reduce')}` : '', actionMix.review ? `${actionMix.review} ${t('rq_type_review')}` : '', actionMix.watch ? `${actionMix.watch} ${t('rq_type_watch')}` : ''].filter(Boolean).join(' · ')
    : t('dash_no_actions')

  function dismissReview(symbolNorm: string) {
    // eslint-disable-next-line react-hooks/purity
    const next = { ...dismissed, [symbolNorm]: Date.now() + DISMISS_MS }
    setDismissed(next)
    try { localStorage.setItem(DISMISS_KEY, JSON.stringify(next)) } catch { /* ignore */ }
  }

  const usdCount = holdings.filter(h => h.currency === 'USD').length
  const myrCount = holdings.filter(h => h.currency === 'MYR').length

  /* ── Empty state ─────────────────────────────────────────── */
  if (!holdings.length) {
    return (
      <div>
        <div className="section-header">
          <div>
            <h1 className="section-title">{t('nav_dashboard')}</h1>
            <p className="section-sub">{t('empty_sub')}</p>
          </div>
        </div>
        <Panel>
          <PanelBody>
            <EmptyState
              icon={<Upload size={20} />}
              title={t('empty_title')}
              sub={t('empty_desc')}
              actions={
                <Link href="/holdings" className="btn btn-primary btn-sm">
                  <Upload size={13} />
                  {t('holdings_import')}
                </Link>
              }
            />
          </PanelBody>
        </Panel>
      </div>
    )
  }

  /* ── Loaded state ────────────────────────────────────────── */
  return (
    <div className="dash-page">
      {/* Ticker pulse — full width, top of stage (drops below the hero on mobile) */}
      {/* Dual ticker — Hot List (← left) over My Holdings (→ right) */}
      <div className="ticker-dual">
        <TickerStrip items={hotItems}    direction="left" />
        <TickerStrip items={tickerItems} direction="right" />
      </div>

      <div className="section-header">
        <div>
          <h1 className="section-title">{t('nav_dashboard')}</h1>
          <p className="section-sub">
            {holdings.length} {t('positions_label')} · {usdCount} USD{myrCount ? ` · ${myrCount} MYR` : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            onClick={() => refreshQuotes()}
            disabled={quoteRefreshing}
            className="btn btn-ghost btn-sm"
          >
            <RefreshCw size={13} className={quoteRefreshing ? 'animate-spin' : ''} />
            {quoteRefreshing ? t('quotes_refreshing') : t('quotes_refresh')}
          </button>
          <ImportCsvButton
            onImported={async (n) => {
              const rows  = await loadHoldings()
              await refreshQuotes(rows)
              const usd   = rows.filter(r => r.currency === 'USD').length
              const myr   = rows.filter(r => r.currency === 'MYR').length
              const count = rows.length || n
              const split = `${usd} USD${myr ? ` · ${myr} MYR` : ''}`
              setToast({
                tone:   'success',
                title:  t('toast_portfolio_updated'),
                detail: `${t('toast_positions_loaded', { n: count })} (${split})`,
              })
            }}
            onError={(msg) => setToast({ tone: 'error', title: t('toast_import_failed'), detail: msg })}
          />
        </div>
      </div>

      {toast && (
        <Toast
          tone={toast.tone}
          title={toast.title}
          detail={toast.detail}
          onClose={() => setToast(null)}
        />
      )}

      {/* Hero (compact portfolio summary) + a row of 4 KPI cards (v5.1) */}
      {/* Command header — Hero (left) + KPI 2×2 (right) in one band (v5.1.1) */}
      <div className="dash-cmd">
        <div className={`hero-card hero-card--compact ${
          todayTone === 'positive' ? 'hero-card-positive-tint' :
          todayTone === 'negative' ? 'hero-card-negative-tint' : ''
        }`}>
          <div className="hero-head">
            <div className="hero-card-label">{t('dash_holdings_value')}</div>
            <div className="chip-group" role="group" aria-label={t('a11y_primary_currency')}>
              <button type="button" onClick={() => setPrimaryCurrency('USD')} className={`chip${primaryCurrency === 'USD' ? ' chip--active' : ''}`}>USD</button>
              <button type="button" onClick={() => setPrimaryCurrency('MYR')} className={`chip${primaryCurrency === 'MYR' ? ' chip--active' : ''}`}>MYR</button>
            </div>
          </div>

          <div className="hero-grid">
            {/* LEFT — portfolio value (today's movement now lives in the KPI card) */}
            <div className="hero-main">
              <div className="hero-value-block">
                <DashMoney value={heroPrimaryValue} currency={primaryCurrency} className="dash-money--hero" />
                <span className="hero-card-secondary">= <DashMoney value={heroSecondaryValue} currency={heroSecondaryCurr} className="dash-money--secondary" /></span>
              </div>
              <div className="hero-mini-grid">
                <span className="hero-mini hero-mini--cost">
                  <span className="hero-mini-label">{t('dash_cost_basis')}</span>
                  <span className="hero-mini-value"><DashMoney value={toDisplay(costUsd)} currency={primaryCurrency} className="dash-money--mini" /></span>
                </span>
                <span className={`hero-mini ${totalReturnPct >= 0 ? 'hero-mini--positive' : 'hero-mini--negative'}`}>
                  <span className="hero-mini-label">{t('holdings_total_return')}</span>
                  <span className={`hero-mini-value ${totalReturnPct >= 0 ? 'text-positive' : 'text-negative'}`}>{fmt.pctSigned(totalReturnPct, 1)}</span>
                </span>
                <span className="hero-mini hero-mini--focus">
                  <span className="hero-mini-label">{t('dash_largest_weight')}</span>
                  <span className="hero-mini-value">{largest ? `${largest.symbol} ${fmt.pct(largest.portfolioWeight, 0)}` : t('hero_none')}</span>
                </span>
              </div>
            </div>

            {/* RIGHT - compact command facts, all derived from existing holdings data. */}
            <div className="hero-brief">
              <div className="hero-brief-row hero-brief-row--strong">
                <span className="hero-brief-label">{t('hero_today_winner')}</span>
                <span className="hero-brief-value">
                  {todayWinner
                    ? <><span>{todayWinner.symbol}</span><span className={todayWinner.todayPct >= 0 ? 'text-positive' : 'text-negative'}>{fmt.pctSigned(todayWinner.todayPct, 1)}</span></>
                    : t('hero_none')}
                </span>
              </div>
              <div className="hero-brief-row">
                <span className="hero-brief-label">{t('hero_today_loser')}</span>
                <span className="hero-brief-value">
                  {todayLoser
                    ? <><span>{todayLoser.symbol}</span><span className={todayLoser.todayPct >= 0 ? 'text-positive' : 'text-negative'}>{fmt.pctSigned(todayLoser.todayPct, 1)}</span></>
                    : t('hero_none')}
                </span>
              </div>
              <div className="hero-brief-row">
                <span className="hero-brief-label">{t('holdings_sum_open')}</span>
                <span className="hero-brief-value"><span>{holdings.length}</span></span>
              </div>
              <div className="hero-brief-row hero-brief-row--muted">
                <span className="hero-brief-label">{t('holdings_sum_closed')}</span>
                <span className="hero-brief-value"><span>{closedCount}</span></span>
              </div>
            </div>
          </div>
        </div>

        <div className="dash-kpis cmd-kpis">
          <StatCard
            className="stat-card--lead"
            label={t('dash_today_pl')}
            icon={<TrendingUp size={15} />}
            value={
              <span className="kpi-inline">
                <DashMoney value={toDisplay(todayPlUsd)} currency={primaryCurrency} signed className="dash-money--kpi" />
                <DeltaBadge value={todayPct} variant="pill" />
              </span>
            }
            tone={todayTone}
            sub={<span className="text-tertiary">{t('dash_today_sub')}</span>}
          />
          <StatCard
            label={t('dash_total_pl')}
            icon={<Wallet size={15} />}
            value={
              <span className="kpi-inline">
                <DashMoney value={toDisplay(totalPlUsd)} currency={primaryCurrency} signed className="dash-money--kpi" />
                <DeltaBadge value={totalReturnPct} variant="pill" />
              </span>
            }
            tone={totalPlUsd > 0 ? 'positive' : totalPlUsd < 0 ? 'negative' : 'neutral'}
            sub={<span className="text-tertiary">{t('dash_total_sub')}</span>}
          />
          <StatCard
            label={t('dash_realized_pl')}
            icon={<BadgeDollarSign size={15} />}
            value={
              <span className="kpi-inline">
                <DashMoney value={toDisplay(realizedUsd)} currency={primaryCurrency} signed className="dash-money--kpi" />
              </span>
            }
            tone={realizedUsd > 0 ? 'positive' : realizedUsd < 0 ? 'negative' : 'neutral'}
            sub={<span className="text-tertiary">{t('dash_realized_sub')}</span>}
          />
          <StatCard
            label={t('dash_unrealized')}
            icon={<Coins size={15} />}
            value={
              <span className="kpi-inline">
                <DashMoney value={toDisplay(unrealizedUsd)} currency={primaryCurrency} signed className="dash-money--kpi" />
                <DeltaBadge value={costUsd > 0 ? (unrealizedUsd / costUsd) * 100 : 0} variant="pill" />
              </span>
            }
            tone={unrealizedUsd > 0 ? 'positive' : unrealizedUsd < 0 ? 'negative' : 'neutral'}
            sub={<span className="text-tertiary">{t('dash_unrealized_sub')}</span>}
          />
        </div>
      </div>

      {/* Row 2 - command body: Decision Brief is primary; reference panels stay quiet. */}
      <div className="dash-command-grid">
        <div className="dash-command-main">
          <Panel className="decision-panel decision-panel--main panel--tier1">
            <PanelHead title={t('dash_decision_brief')} meta={t('dash_decision_meta')} />
            <PanelBody>
              <div className="decision-verdict">
                <div>
                  <span className="decision-verdict-label">{t('dash_today_brief')}</span>
                  <p>{decisionBrief}</p>
                </div>
                <div className="decision-verdict-stat">
                  <span>{t('dash_priority_queue')}</span>
                  <strong>{actionMix.total}</strong>
                </div>
              </div>

              <div className="decision-grid">
                <section className="decision-actions" aria-label={t('dash_action_center')}>
                  <div className="decision-subhead">
                    <span>{t('dash_action_center')}</span>
                    <span>{t('dash_review_sub')}</span>
                  </div>
                  {reviewQueue.length ? (
                    <>
                      <div className="ac-list">
                        {reviewQueue.slice(0, 5).map(item => {
                          const k = item.type.toLowerCase()
                          const overdue   = item.reviewDays != null && item.reviewDays < 0
                          const isLargest = largest != null && item.symbolNormalized === largest.symbolNormalized
                          // Lead = headline metric, ctx = muted "why it matters". Facts only.
                          const lead =
                            item.type === 'REVIEW' ? (overdue ? t('rq_overdue_days', { n: Math.abs(item.reviewDays!) }) : t('rq_review_due'))
                            : item.type === 'WATCH' ? t('ac_weight_ctx', { pct: fmt.pct(item.portfolioWeight, 0) })
                            : `▼ ${fmt.pct(Math.abs(item.unrealizedPlPct), 0)}`
                          const ctx = item.type === 'WATCH'
                            ? (isLargest ? t('ac_largest') : '')
                            : `${t('ac_weight_ctx', { pct: fmt.pct(item.portfolioWeight, 0) })}${isLargest ? ` · ${t('ac_largest')}` : ''}`
                          return (
                            <div key={item.symbolNormalized} className={`ac-row ac-row--${k}`}>
                              <span className="ac-row-pill">{t(`rq_type_${k}`)}</span>
                              <Link href={`/holdings/${encodeURIComponent(item.symbolNormalized)}`} className="ac-row-main">
                                <span className="ac-row-top">
                                  <span className="ac-row-sym">{item.symbol}</span>
                                  <span className="ac-row-lead">{lead}</span>
                                </span>
                                {ctx && <span className="ac-row-ctx">{ctx}</span>}
                              </Link>
                              <Link href={`/holdings/${encodeURIComponent(item.symbolNormalized)}`} className="ac-row-cta">
                                {t('rq_view_position')}<ArrowRight size={12} />
                              </Link>
                              <button
                                type="button"
                                className="ac-row-x"
                                onClick={() => dismissReview(item.symbolNormalized)}
                                title={t('rq_dismiss')}
                                aria-label={t('rq_dismiss')}
                              >
                                <X size={13} />
                              </button>
                            </div>
                          )
                        })}
                      </div>
                      {reviewQueue.length > 5 && (
                        <Link href="/holdings" className="ac-more">
                          {t('rq_more', { n: reviewQueue.length - 5 })}<ArrowRight size={12} />
                        </Link>
                      )}
                    </>
                  ) : (
                    <div className="attention-clear">{t('rq_clear')}</div>
                  )}
                </section>

                <section className="decision-risk" aria-label={t('dash_risk')}>
                  <div className="decision-subhead">
                    <span>{t('dash_risk')}</span>
                    <span>{t('dash_risk_meta')}</span>
                  </div>
                  <div className="risk-summary">
                    <div className="risk-summary-head">
                      <span className="risk-summary-score">{risk.score}</span>
                      <span className={`risk-summary-level risk-summary-level--${risk.level as RiskLevel}`}>{t(`risk_${risk.level}`)}</span>
                    </div>
                    <div className="risk-meter" aria-hidden="true">
                      <span className={`risk-meter-fill risk-meter-fill--${risk.level as RiskLevel}`} style={{ width: `${Math.min(100, Math.max(0, risk.score))}%` }} />
                    </div>
                    <div className="riskd">
                      <div className="riskd-head">{t('risk_drivers_head')}</div>
                      <ul className="riskd-list">
                        <li className="riskd-item">{
                          largest && risk.maxWeight >= 25
                            ? fillTmpl(t('risk_drv_conc'), { sym: largest.symbol, pct: fmt.pct(risk.maxWeight, 0) })
                            : fillTmpl(t('risk_drv_conc_ok'), {})
                        }</li>
                        <li className="riskd-item">{
                          speculativeWeight >= 30
                            ? fillTmpl(t('risk_drv_spec'), { pct: fmt.pct(speculativeWeight, 0) })
                            : fillTmpl(t('risk_drv_spec_ok'), {})
                        }</li>
                        <li className="riskd-item">{
                          brokenCount === 0 ? fillTmpl(t('risk_drv_red_ok'), {})
                          : brokenCount === 1 ? fillTmpl(t('risk_drv_red_one'), {})
                          : fillTmpl(t('risk_drv_red'), { n: String(brokenCount) })
                        }</li>
                      </ul>
                    </div>
                  </div>
                </section>
              </div>

              <div className="decision-insight-strip">
                <div className="decision-insight">
                  <span>{t('dash_action_mix')}</span>
                  <strong>{briefActionRead}</strong>
                </div>
                <div className="decision-insight">
                  <span>{t('dash_risk_source')}</span>
                  <strong>{largest ? `${largest.symbol} ${fmt.pct(largest.portfolioWeight, 0)}` : t('hero_none')}</strong>
                </div>
                <div className="decision-insight">
                  <span>{t('dash_deep_red')}</span>
                  <strong>{brokenCount}</strong>
                </div>
              </div>
            </PanelBody>
          </Panel>

          <Panel className="panel--tier3 portfolio-health-panel portfolio-health-panel--inline">
            <PanelHead title={t('dash_portfolio_health')} meta={t('dash_health_meta')} />
            <PanelBody>
              <div className="ph-big">
                <div className="ph-b"><span className="ph-b-v">{fmt.pct(health.winRate, 0)}</span><span className="ph-b-l">{t('ph_win_rate')}</span></div>
                <div className="ph-b"><span className="ph-b-v text-positive">{fmt.pctSigned(health.avgGain, 0)}</span><span className="ph-b-l">{t('ph_avg_winner')}</span></div>
                <div className="ph-b"><span className="ph-b-v text-negative">{fmt.pctSigned(health.avgLoss, 0)}</span><span className="ph-b-l">{t('ph_avg_loser')}</span></div>
                <div className="ph-b"><span className="ph-b-v text-negative">{plSummary.bigLose}</span><span className="ph-b-l">{t('ph_below50')}</span></div>
              </div>
              <div className="ph-histo ph-histo--compact">
                <PlHistogram items={withWeight.map(h => ({ unrealizedPlPct: h.unrealizedPlPct }))} />
              </div>
            </PanelBody>
          </Panel>
        </div>

        <div className="dash-reference-rail">
          <div className="dash-reference-stack">
            <Panel className="panel--fill sector-recede panel--tier3">
              <PanelHead
                title={t('dash_sector_alloc')}
                meta={t('meta_by_market_value')}
                actions={
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setAllocView(nextAllocView(allocView))}
                    title={t('dash_switch_view')}
                  >
                    <Repeat size={12} />
                    {ALLOC_VIEWS.find(v => v.id === allocView)?.label}
                  </button>
                }
              />
              <PanelBody className="panel-body--fill">
                <AllocationViews slices={sectorSlices} centerValue={`${formatDashAmount(toDisplay(combined), true)} ${primaryCurrency}`} stars={allocStars} total={combined} view={allocView} />
                {allocView === 'donut' && allocationRead && (
                  <div className="allocation-readout">
                    <span>{t('alloc_diversification')}</span>
                    <p>{allocationRead}</p>
                  </div>
                )}
              </PanelBody>
            </Panel>

            <Panel className="panel--tier3">
              <PanelHead title={t('dash_return_board')} meta={t('holdings_total_return')} />
              <PanelBody>
                <div className="return-board">
                  {([['dash_top_winners', board.winners, 'win'], ['dash_top_losers', board.losers, 'lose']] as const).map(([titleKey, rows, kind]) => (
                    <div key={titleKey} className="return-board-col">
                      <div className="return-board-title">{t(titleKey)}</div>
                      {rows.length ? (
                        <div className="medal-list">
                          {rows.slice(0, 3).map((h, i) => (
                            <Link key={h.id} href={`/holdings/${encodeURIComponent(h.symbolNormalized)}`} className={`medal-card medal-card--${kind}`}>
                              <span className={`medal-rank medal-rank--${kind}`}>{i + 1}</span>
                              <span className="medal-main">
                                <span className="medal-sym">{h.symbol}</span>
                                <span className="medal-meta">{t('col_weight')} {fmt.pct(h.portfolioWeight, 1)} · <DashMoney value={toDisplay(h.usdValue)} currency={primaryCurrency} compact className="dash-money--meta" /></span>
                              </span>
                              <span className={`medal-pct ${kind === 'win' ? 'text-positive' : 'text-negative'}`}>{fmt.pctSigned(h.totalReturnPct, 1)}</span>
                            </Link>
                          ))}
                        </div>
                      ) : <div className="attention-clear">{t('hero_none')}</div>}
                    </div>
                  ))}
                </div>
              </PanelBody>
            </Panel>
          </div>
        </div>
      </div>

      {/* Row 5 — My Holdings (full simplified list; row → position detail) */}
      <Panel className="panel--tier3">
        <PanelHead
          title={t('dash_my_holdings')}
          meta={`${holdings.length} ${t('positions_label')}`}
          actions={
            <Link href="/holdings" className="btn btn-ghost btn-sm">
              {t('dash_view_all')}<ArrowRight size={12} />
            </Link>
          }
        />
        <PanelBody flush>
          <div className="dash-hold-scroll" style={{ overflowX: 'auto' }}>
            <table className="data-table dash-holdings-table">
              <thead>
                <tr>
                  <th>{t('col_symbol')}</th>
                  <th className="num">{t('col_weight')}</th>
                  <th className="num">{t('col_value')}</th>
                  <th className="num">{t('holdings_total_return')}</th>
                  <th className="num">{t('col_unrealized_short')}</th>
                  <th className="num">{t('col_today')}</th>
                  <th className="dash-hold-act">{t('col_action')}</th>
                </tr>
              </thead>
              <tbody>
                {holdingsFull.map(h => (
                  <tr
                    key={h.id}
                    className="dash-hold-row"
                    onClick={() => router.push(`/holdings/${encodeURIComponent(h.symbolNormalized)}`)}
                  >
                    <td>
                      <SymCell symbol={h.symbol} name={stockName(h.symbol, h.name, lang)} currency={h.currency} logoSize={24} />
                    </td>
                    <td className="num text-tabular text-tertiary">{fmt.pct(h.portfolioWeight, 1)}</td>
                    <td className="num text-tabular">{fmt.money(toDisplay(h.usdValue), primaryCurrency)}</td>
                    <td className="num"><span className={h.totalReturnPct >= 0 ? 'text-positive' : 'text-negative'}>{fmt.pctSigned(h.totalReturnPct, 1)}</span></td>
                    <td className="num text-tabular"><span className={h.unrealizedPl >= 0 ? 'text-positive' : 'text-negative'}>{fmt.moneySigned(toDisplay(usdEquiv(h.unrealizedPl, h.currency, fxRate)), primaryCurrency)}</span></td>
                    <td className="num"><span className={h.todayPct >= 0 ? 'text-positive' : 'text-negative'}>{fmt.pctSigned(h.todayPct, 1)}</span></td>
                    <td className="dash-hold-act"><span className={`badge badge--${ACTION_TONE[h.action]}`}>{t(`tax_${h.action}`)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PanelBody>
      </Panel>

    </div>
  )
}
