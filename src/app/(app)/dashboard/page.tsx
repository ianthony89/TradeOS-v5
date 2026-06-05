'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { RefreshCw, Upload, Wallet, BadgeDollarSign, Repeat, X, ArrowRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useHoldingsStore } from '@/stores/holdings'
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
import { classifyStrategy, classifyAction } from '@/lib/portfolio/taxonomy'
import { reviewStatus } from '@/lib/portfolio/review-status'
import { loadAllPositionIntel } from '@/lib/portfolio/position-intel'

/** USD-equivalent of a native amount (MYR ÷ FX). Module-scope = stable. */
function usdEquiv(amt: number, currency: string, fx: number): number {
  const r = fx > 0 ? fx : 4   // guard: never divide by a zero/blank FX
  return currency === 'MYR' ? amt / r : amt
}

/* Review Queue dismiss — local only (no backend), hidden for 7 days. */
const DISMISS_KEY = 'tradeos-dash-dismiss'
const DISMISS_MS  = 7 * 24 * 60 * 60 * 1000
function loadDismissed(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(DISMISS_KEY) || '{}') } catch { return {} }
}

type ReviewType = 'EXIT' | 'REDUCE' | 'REVIEW'
interface ReviewItem {
  symbol: string; symbolNormalized: string; name: string; currency: string
  type: ReviewType; rank: number; unrealizedPlPct: number; portfolioWeight: number
}

export default function DashboardPage() {
  const { t, lang } = useI18n()
  const supabase = createClient()
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
  const [closedCount, setClosedCount] = useState(0)
  const [dismissed, setDismissed] = useState<Record<string, number>>({})   // Review Queue (7d, localStorage)

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
  const refreshQuotes = useCallback(async () => {
    if (!holdings.length || quoteRefreshing) return
    setRefreshing(true)
    try {
      const symbols = holdings.map(h => h.symbolNormalized)
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
    finally { setRefreshing(false) }
  }, [holdings, quoteRefreshing, setRefreshing, updateQuotes, setQuotesUpdated])

  useEffect(() => {
    if (!holdings.length) return
    refreshQuotes()
    const id = setInterval(refreshQuotes, 30 * 60 * 1000)
    return () => clearInterval(id)
  }, [holdings.length]) // eslint-disable-line react-hooks/exhaustive-deps

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

  /* Today's movers — best & worst by TODAY's % change (v5.0.8) */
  const { todayWinner, todayLoser } = useMemo(() => {
    if (!withWeight.length) return { todayWinner: undefined, todayLoser: undefined }
    const scored = withWeight.map(h => {
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

  /* Ticker strip — one chip per holding */
  const tickerItems = useMemo(() =>
    live.filter(h => h.currentPrice > 0)
      .map(h => ({ symbol: h.symbol, price: h.currentPrice, changePct: h.unrealizedPlPct, currency: h.currency })),
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

  /* Stars for the Starfield allocation view — one star per holding */
  const allocStars = useMemo(() =>
    withWeight.map(h => {
      const sector = getSector(h.symbol, h.assetType)
      return { symbol: h.symbol, sector: t(sectorKey(sector)), weight: h.portfolioWeight, color: getSectorColor(sector) }
    }),
  [withWeight, t])

  /* Top Holdings — top 5 by weight, with total-return % (v5.0.8) */
  const topHoldings = useMemo(() =>
    topPositions.slice(0, 5).map(h => {
      const cost = h.avgCost * h.quantity
      return {
        id: h.id, symbol: h.symbol, symbolNormalized: h.symbolNormalized, name: h.name, currency: h.currency,
        weight: h.portfolioWeight,
        totalReturnPct: cost > 0 ? ((h.unrealizedPl + h.realizedPl) / cost) * 100 : 0,
      }
    }),
  [topPositions])

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
      else continue
      out.push({ symbol: h.symbol, symbolNormalized: h.symbolNormalized, name: h.name, currency: h.currency, type, rank, unrealizedPlPct: h.unrealizedPlPct, portfolioWeight: h.portfolioWeight })
    }
    return out.sort((a, b) => a.rank - b.rank || a.unrealizedPlPct - b.unrealizedPlPct).slice(0, 8)
  }, [withWeight, intelMap, dismissed])

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
            onClick={refreshQuotes}
            disabled={quoteRefreshing}
            className="btn btn-ghost btn-sm"
          >
            <RefreshCw size={13} className={quoteRefreshing ? 'animate-spin' : ''} />
            {quoteRefreshing ? t('quotes_refreshing') : t('quotes_refresh')}
          </button>
          <ImportCsvButton
            onImported={async (n) => {
              const rows  = await loadHoldings()
              refreshQuotes()
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

      {/* Hero + 4 mini stats side-by-side */}
      <div className="dash-overview">
        <div className={`hero-card ${
          todayTone === 'positive' ? 'hero-card-positive-tint' :
          todayTone === 'negative' ? 'hero-card-negative-tint' : ''
        }`}>
          <div className="hero-card-header">
            <div className="hero-card-label">{t('dash_holdings_value')}</div>
            <div className="chip-group" role="group" aria-label={t('a11y_primary_currency')}>
              <button
                type="button"
                onClick={() => setPrimaryCurrency('USD')}
                className={`chip${primaryCurrency === 'USD' ? ' chip--active' : ''}`}
              >
                USD
              </button>
              <button
                type="button"
                onClick={() => setPrimaryCurrency('MYR')}
                className={`chip${primaryCurrency === 'MYR' ? ' chip--active' : ''}`}
              >
                MYR
              </button>
            </div>
          </div>
          <span className="hero-card-primary">
            {fmt.money(heroPrimaryValue, primaryCurrency)}
          </span>
          <span className="hero-card-secondary">
            = {fmt.money(heroSecondaryValue, heroSecondaryCurr)}
          </span>
          <div className="hero-card-sub">
            <DeltaBadge value={todayPct} variant="pill" />
            <span>·</span>
            <span>{fmt.moneySigned(toDisplay(todayPlUsd), primaryCurrency)} {t('word_today')}</span>
          </div>

          {/* Compact intelligence row — fills the hero efficiently */}
          <div className="hero-intel">
            <div className="hero-intel-cell">
              <span className="hero-intel-label">{t('hero_largest')}</span>
              <span className="hero-intel-value">
                {largest
                  ? <>{largest.symbol}{' '}<span className="text-tertiary">{fmt.pct(largest.portfolioWeight, 1)}</span></>
                  : t('hero_none')}
              </span>
            </div>
            <div className="hero-intel-cell">
              <span className="hero-intel-label">{t('hero_today_winner')}</span>
              <span className="hero-intel-value">
                {todayWinner
                  ? <>{todayWinner.symbol}{' '}<span className={todayWinner.todayPct >= 0 ? 'text-positive' : 'text-negative'}>{fmt.pctSigned(todayWinner.todayPct, 1)}</span></>
                  : t('hero_none')}
              </span>
            </div>
            <div className="hero-intel-cell">
              <span className="hero-intel-label">{t('hero_today_loser')}</span>
              <span className="hero-intel-value">
                {todayLoser
                  ? <>{todayLoser.symbol}{' '}<span className={todayLoser.todayPct >= 0 ? 'text-positive' : 'text-negative'}>{fmt.pctSigned(todayLoser.todayPct, 1)}</span></>
                  : t('hero_none')}
              </span>
            </div>
          </div>
        </div>

        {/* v5.0.8: one 2×2 on desktop + mobile — Today's lives in the hero,
            Risk Score is gone (Portfolio Snapshot covers health). */}
        <div className="dash-mini-stats">
          <StatCard
            label={t('dash_total_pl')}
            icon={<Wallet size={15} />}
            value={fmt.moneySigned(toDisplay(totalPlUsd), primaryCurrency)}
            tone={totalPlUsd > 0 ? 'positive' : totalPlUsd < 0 ? 'negative' : 'neutral'}
            sub={<DeltaBadge value={totalReturnPct} variant="pill" />}
          />
          <StatCard
            label={t('dash_realized_pl')}
            icon={<BadgeDollarSign size={15} />}
            value={fmt.moneySigned(toDisplay(realizedUsd), primaryCurrency)}
            tone={realizedUsd > 0 ? 'positive' : realizedUsd < 0 ? 'negative' : 'neutral'}
            sub={<span className="text-tertiary">{t('dash_realized_sub')}</span>}
          />
          <StatCard
            label={t('holdings_sum_open')}
            value={holdings.length}
            sub={<span className="text-tertiary">{usdCount} USD{myrCount ? ` · ${myrCount} MYR` : ''}</span>}
          />
          <StatCard
            label={t('holdings_sum_closed')}
            value={closedCount}
          />
        </div>
      </div>

      {/* Review Queue (v5.0.8) — typed action items (EXIT / REDUCE / REVIEW),
          one-line reason, deep-link to the Hub, 7-day Dismiss (local only). */}
      <div className="dash-review" style={{ marginBottom: 18 }}>
        <Panel>
          <PanelHead title={t('dash_review_queue')} meta={t('dash_review_sub')} />
          <PanelBody>
            {reviewQueue.length ? (
              <div className="rq2-list">
                {reviewQueue.map(item => {
                  const reason = item.type === 'REVIEW'
                    ? t('rq_review_reason')
                    : item.unrealizedPlPct < 0
                      ? t('rq_down', { pct: fmt.pct(Math.abs(item.unrealizedPlPct), 0) })
                      : t('rq_weight', { pct: fmt.pct(item.portfolioWeight, 0) })
                  const k = item.type.toLowerCase()
                  return (
                    <div key={item.symbolNormalized} className={`rq2-item rq2-item--${k}`}>
                      <span className="rq2-type">{t(`rq_type_${k}`)}</span>
                      <Link href={`/holdings/${encodeURIComponent(item.symbolNormalized)}`} className="rq2-main">
                        <span className="rq2-sym">{item.symbol}</span>
                        <span className="rq2-reason">{reason}</span>
                      </Link>
                      <Link href={`/holdings/${encodeURIComponent(item.symbolNormalized)}`} className="rq2-cta">
                        {t(`rq_btn_${k}`)}<ArrowRight size={12} />
                      </Link>
                      <button
                        type="button"
                        className="rq2-dismiss"
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
            ) : (
              <div className="attention-clear">{t('rq_clear')}</div>
            )}
          </PanelBody>
        </Panel>
      </div>

      {/* Portfolio Snapshot (replaces Risk Assessment) + Top Holdings */}
      <div className="grid-2" style={{ marginBottom: 18 }}>
        <Panel>
          <PanelHead title={t('dash_snapshot')} meta={t('dash_snapshot_sub')} />
          <PanelBody>
            <div className="snapshot-grid">
              <div className="snapshot-stat">
                <span className="snapshot-label">{t('dash_snap_largest')}</span>
                <span className="snapshot-value">
                  {largest ? <>{largest.symbol} <span className="text-tertiary">{fmt.pct(largest.portfolioWeight, 1)}</span></> : '—'}
                </span>
              </div>
              <div className="snapshot-stat">
                <span className="snapshot-label">{t('dash_snap_speculative')}</span>
                <span className="snapshot-value">{fmt.pct(speculativeWeight, 1)}</span>
              </div>
              <div className="snapshot-stat">
                <span className="snapshot-label">{t('dash_snap_deepred')}</span>
                <span className={`snapshot-value ${brokenCount > 0 ? 'text-negative' : ''}`}>{t('dash_snap_deepred_n', { n: brokenCount })}</span>
              </div>
            </div>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHead
            title={t('dash_top_holdings')}
            actions={
              <Link href="/holdings" className="btn btn-ghost btn-sm">
                {t('dash_view_all')}<ArrowRight size={12} />
              </Link>
            }
          />
          <PanelBody flush>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table top-holdings-table">
                <thead>
                  <tr>
                    <th>{t('col_symbol')}</th>
                    <th className="num">{t('col_weight')}</th>
                    <th className="num">{t('holdings_total_return')}</th>
                  </tr>
                </thead>
                <tbody>
                  {topHoldings.map(h => (
                    <tr key={h.id}>
                      <td>
                        <Link href={`/holdings/${encodeURIComponent(h.symbolNormalized)}`} className="holdings-sym-link">
                          <SymCell symbol={h.symbol} name={stockName(h.symbol, h.name, lang)} currency={h.currency} logoSize={24} />
                        </Link>
                      </td>
                      <td className="num text-tabular text-tertiary">{fmt.pct(h.weight, 1)}</td>
                      <td className="num">
                        <span className={h.totalReturnPct >= 0 ? 'text-positive' : 'text-negative'}>{fmt.pctSigned(h.totalReturnPct, 1)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </PanelBody>
        </Panel>
      </div>

      {/* Sector Allocation + P/L Distribution */}
      <div className="grid-2" style={{ marginBottom: 18 }}>
        <Panel className="panel--fill">
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
            <AllocationViews slices={sectorSlices} centerValue={fmt.compact(combined, 'USD')} stars={allocStars} total={combined} view={allocView} />
          </PanelBody>
        </Panel>

        <Panel className="dash-histogram">
          <PanelHead title={t('dash_pl_distribution')} meta={t('dash_pl_distribution_meta')} />
          <PanelBody>
            <PlHistogram items={withWeight.map(h => ({ unrealizedPlPct: h.unrealizedPlPct }))} />
          </PanelBody>
        </Panel>
      </div>
    </div>
  )
}
