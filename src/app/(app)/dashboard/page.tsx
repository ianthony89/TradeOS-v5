'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { RefreshCw, Upload, TrendingUp, Wallet, BadgeDollarSign, Gauge, Lightbulb, Repeat } from 'lucide-react'
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
import { InfoTooltip }     from '@/components/ui/info-tooltip'
import { IntelCard }      from '@/components/ui/intel-card'
import { type MoverItem } from '@/components/ui/movers-panel'
import { RiskByStrategy, type RiskBar } from '@/components/ui/risk-by-strategy'
import { computeRiskScore } from '@/lib/portfolio/risk-score'
import { getSector, getSectorColor, sectorKey } from '@/lib/portfolio/sectors'
import { stockName }      from '@/lib/portfolio/stock-names'
import { classifyStrategy, STRATEGY_TONE } from '@/lib/portfolio/taxonomy'
import { buildAttentionFeed, type AttentionPosition } from '@/lib/portfolio/attention'
import { loadAllPositionIntel } from '@/lib/portfolio/position-intel'
import { computeWatchStatus, type WatchDirection } from '@/lib/portfolio/watchlist-status'

/** USD-equivalent of a native amount (MYR ÷ FX). Module-scope = stable. */
function usdEquiv(amt: number, currency: string, fx: number): number {
  const r = fx > 0 ? fx : 4   // guard: never divide by a zero/blank FX
  return currency === 'MYR' ? amt / r : amt
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

  /* Phase 2B Attention Layer — per-position intelligence + watchlist triggers */
  const [intelMap, setIntelMap] = useState<Map<string, import('@/lib/portfolio/position-intel').PositionIntel>>(new Map())
  const [watchTriggered, setWatchTriggered] = useState<string[]>([])

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
      return open
    }
    return []
  }, [supabase, setHoldings])

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
      if (alive) setIntelMap(im)

      const { data: rows } = await supabase
        .from('watchlist_items')
        .select('symbol, symbol_normalized, alert_price, alert_direction')
        .eq('user_id', user.id)
      const wl = (rows ?? []).map(r => ({
        symbol: r.symbol as string,
        norm:   r.symbol_normalized as string,
        target: Number(r.alert_price),
        dir:    (r.alert_direction ?? null) as WatchDirection | null,
      }))
      if (!wl.length) { if (alive) setWatchTriggered([]); return }

      try {
        const res  = await fetch('/api/quotes', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ symbols: wl.map(w => w.norm) }),
        })
        const json = await res.json()
        const px   = new Map<string, number>()
        for (const q of (json.quotes ?? []) as Array<{ symbol: string; price: number }>) px.set(q.symbol, q.price)
        const trig = wl
          .filter(w => computeWatchStatus(px.get(w.norm) ?? 0, w.target, w.dir).status === 'TRIGGERED')
          .map(w => w.symbol)
        if (alive) setWatchTriggered(trig)
      } catch { /* keep none */ }
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

  /* Movers — exactly 3 + 3 */
  const { winners, losers } = useMemo(() => {
    const sorted = [...withWeight].sort((a, b) => b.unrealizedPlPct - a.unrealizedPlPct)
    const wins: MoverItem[] = sorted
      .filter(h => h.unrealizedPlPct > 0)
      .slice(0, 3)
      .map(h => ({
        id: h.id, symbol: h.symbol, name: stockName(h.symbol, h.name, lang), currency: h.currency,
        unrealizedPl: h.unrealizedPl, unrealizedPlPct: h.unrealizedPlPct,
      }))
    const los: MoverItem[] = sorted
      .filter(h => h.unrealizedPlPct < 0)
      .reverse()
      .slice(0, 3)
      .map(h => ({
        id: h.id, symbol: h.symbol, name: stockName(h.symbol, h.name, lang), currency: h.currency,
        unrealizedPl: h.unrealizedPl, unrealizedPlPct: h.unrealizedPlPct,
      }))
    return { winners: wins, losers: los }
  }, [withWeight, lang])

  /* Sector donut slices */
  const sectorSlices = useMemo<DonutSlice[]>(() => {
    if (!withWeight.length || combined <= 0) return []
    const buckets = new Map<string, number>()
    for (const h of withWeight) {
      const sec = getSector(h.symbol, h.assetType)
      buckets.set(sec, (buckets.get(sec) ?? 0) + h.usdValue)
    }
    return [...buckets.entries()]
      .map(([sec, value]) => ({
        name:  t(sectorKey(sec)),
        value,
        pct:   (value / combined) * 100,
        color: getSectorColor(sec),
      }))
      .sort((a, b) => b.pct - a.pct)
  }, [withWeight, combined, t])

  /* Risk-by-strategy bars (CORE / TACTICAL / SPECULATIVE) */
  const strategyBars = useMemo<RiskBar[]>(() => {
    const buckets = new Map<'CORE'|'TACTICAL'|'SPECULATIVE', number>()
    buckets.set('CORE', 0); buckets.set('TACTICAL', 0); buckets.set('SPECULATIVE', 0)
    for (const h of withWeight) {
      const cls = classifyStrategy({
        symbol: h.symbol, name: h.name, assetType: h.assetType,
        unrealizedPlPct: h.unrealizedPlPct, portfolioWeight: h.portfolioWeight,
      })
      buckets.set(cls, (buckets.get(cls) ?? 0) + h.usdValue)
    }
    return (['CORE','TACTICAL','SPECULATIVE'] as const).map(cls => {
      const value = buckets.get(cls) ?? 0
      const pct   = combined > 0 ? (value / combined) * 100 : 0
      const tone  = STRATEGY_TONE[cls]
      const color =
        tone === 'positive' ? 'var(--positive)' :
        tone === 'warning'  ? 'var(--warning)'  :
                              'var(--accent)'
      return { name: t(`tax_${cls}`), pct, value, color, hint: t(`risk_s_${cls.toLowerCase()}_h`) }
    })
  }, [withWeight, combined, t])

  /* Ticker strip — one chip per holding */
  const tickerItems = useMemo(() =>
    live
      .filter(h => h.currentPrice > 0)
      .map(h => ({
        symbol:    h.symbol,
        price:     h.currentPrice,
        changePct: h.unrealizedPlPct,
        currency:  h.currency,
      })),
  [live])

  /* ── Attention Layer (Phase 2B) ──────────────────────────────
     One prioritized feed (price + review + documentation gaps +
     watchlist) plus the complete review queue. Every item deep-links
     into the Position Hub (Decision Layer). */
  const top5Norm = useMemo(
    () => new Set([...withWeight].sort((a, b) => b.portfolioWeight - a.portfolioWeight).slice(0, 5).map(h => h.symbolNormalized)),
    [withWeight],
  )
  const attentionPositions = useMemo<AttentionPosition[]>(() =>
    withWeight.map(h => {
      const intel = intelMap.get(h.symbolNormalized)
      return {
        symbol: h.symbol, symbolNormalized: h.symbolNormalized,
        unrealizedPlPct: h.unrealizedPlPct, portfolioWeight: h.portfolioWeight,
        hasThesis:  !!intel && !!(intel.thesis || intel.bullCase || intel.bearCase || intel.invalidation),
        hasTargets: !!intel && (intel.targetPrice != null || intel.trimAbove != null || intel.addBelow != null || intel.fairValue != null),
        nextReviewAt: intel?.nextReviewAt ?? null,
      }
    }),
  [withWeight, intelMap])
  const attention = useMemo(
    () => buildAttentionFeed({ positions: attentionPositions, topByWeight: top5Norm, watchTriggered, fmtPct: (v) => fmt.pct(v, 1) }),
    [attentionPositions, top5Norm, watchTriggered],
  )

  /* Hero intelligence row */
  const largest   = topPositions[0]
  const topWinner = winners[0]
  const topLoser  = losers[0]

  /* Speculative weight — for risk stat tile */
  const speculativeWeight = useMemo(() => {
    return withWeight.reduce((s, h) => {
      const cls = classifyStrategy({
        symbol: h.symbol, name: h.name, assetType: h.assetType,
        unrealizedPlPct: h.unrealizedPlPct, portfolioWeight: h.portfolioWeight,
      })
      return cls === 'SPECULATIVE' ? s + h.portfolioWeight : s
    }, 0)
  }, [withWeight])

  /* Stars for the Starfield allocation view — one star per holding */
  const allocStars = useMemo(() =>
    withWeight.map(h => {
      const sector = getSector(h.symbol, h.assetType)
      return { symbol: h.symbol, sector: t(sectorKey(sector)), weight: h.portfolioWeight, color: getSectorColor(sector) }
    }),
  [withWeight, t])

  /* Risk Score — concentration + speculative + drawdown (real formula) */
  const risk = useMemo(() => {
    const maxWeight    = Math.max(0, ...withWeight.map(h => h.portfolioWeight))
    const brokenWeight = withWeight.reduce((s, h) => h.unrealizedPlPct < -50 ? s + h.portfolioWeight : s, 0)
    return { ...computeRiskScore({ maxWeight, speculativeWeight, brokenWeight }), maxWeight, brokenWeight }
  }, [withWeight, speculativeWeight])

  const riskTone = risk.level === 'low' ? 'positive' : risk.level === 'high' ? 'negative' : 'neutral'

  /* Dominant risk driver (weighted) — for the actionable guide line */
  const riskTop = (() => {
    const c = risk.factors.concentration * 0.40
    const s = risk.factors.speculative   * 0.35
    const d = risk.factors.drawdown      * 0.25
    return c >= s && c >= d ? 'concentration' : s >= d ? 'speculative' : 'drawdown'
  })()
  const brokenCount = withWeight.filter(h => h.unrealizedPlPct < -50).length
  const riskActionVars: Record<string, string | number> =
    riskTop === 'concentration'
      ? { symbol: topPositions[0]?.symbol ?? '—', pct: fmt.pct(topPositions[0]?.portfolioWeight ?? 0, 1) }
    : riskTop === 'speculative'
      ? { pct: fmt.pct(speculativeWeight, 1) }
      : { n: brokenCount }

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
    <div>
      {/* Ticker pulse — full width, top of stage */}
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
              <span className="hero-intel-label">{t('hero_top_winner')}</span>
              <span className="hero-intel-value">
                {topWinner
                  ? <>{topWinner.symbol}{' '}<span className="text-positive">{fmt.pctSigned(topWinner.unrealizedPlPct, 1)}</span></>
                  : t('hero_none')}
              </span>
            </div>
            <div className="hero-intel-cell">
              <span className="hero-intel-label">{t('hero_top_loser')}</span>
              <span className="hero-intel-value">
                {topLoser
                  ? <>{topLoser.symbol}{' '}<span className="text-negative">{fmt.pctSigned(topLoser.unrealizedPlPct, 1)}</span></>
                  : t('hero_none')}
              </span>
            </div>
          </div>
        </div>

        <div className="dash-mini-stats">
          <StatCard
            label={t('dash_today_pl')}
            icon={<TrendingUp size={15} />}
            value={fmt.moneySigned(toDisplay(todayPlUsd), primaryCurrency)}
            tone={todayTone}
            sub={<DeltaBadge value={todayPct} variant="pill" />}
          />
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
            label={t('dash_risk_score')}
            icon={<Gauge size={15} />}
            value={<>{risk.score}<span className="text-quaternary" style={{ fontSize: 14 }}>/100</span></>}
            tone={riskTone}
            sub={<span className="text-tertiary">{t(`risk_${risk.level}`)}</span>}
          />
        </div>
      </div>

      {/* Attention Layer — "what needs my attention today" + the review queue.
          Every item deep-links into the Position Hub (Decision Layer). */}
      {/* What needs my attention — full width (Review Queue removed in v5.0.6).
          Open positions only; ordered EXIT / -50% → REDUCE → Review → other. */}
      <div style={{ marginBottom: 18 }}>
        <Panel>
          <PanelHead title={t('attn_title')} meta={t('attn_sub')} />
          <PanelBody>
            {attention.length ? (
              <div className="attention-list attention-list--wide">
                {attention.map(a => (
                  <IntelCard
                    key={a.key}
                    severity={a.severity}
                    icon={a.icon}
                    href={a.href}
                    title={t(a.titleKey, a.titleVars)}
                    detail={t(a.detailKey, a.detailVars)}
                  />
                ))}
              </div>
            ) : (
              <div className="attention-clear">{t('attn_clear')}</div>
            )}
          </PanelBody>
        </Panel>
      </div>

      {/* Allocation donut + Risk by strategy */}
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

        <Panel>
          <PanelHead title={t('dash_risk')} meta={t('dash_risk_meta')} />
          <PanelBody>
            {/* v5.0.6: plain-language risk drivers (no engineering jargon). */}
            <div className="rg-section-label">{t('risk_drivers')}</div>
            <ul className="risk-says">
              <li className="risk-say">
                <span className="risk-say-dot" style={{ background: '#a78bfa' }} />
                {largest
                  ? t('risk_say_concentration', { symbol: largest.symbol, pct: fmt.pct(largest.portfolioWeight, 1) })
                  : t('risk_say_balanced')}
              </li>
              <li className="risk-say">
                <span className="risk-say-dot" style={{ background: 'var(--warning)' }} />
                {t('risk_say_speculative', { pct: fmt.pct(speculativeWeight, 1) })}
              </li>
              {brokenCount > 0 && (
                <li className="risk-say">
                  <span className="risk-say-dot" style={{ background: 'var(--negative)' }} />
                  {t('risk_say_broken', { n: brokenCount })}
                </li>
              )}
            </ul>
            <div className="rg-divider" />
            <div className="rg-section-label">
              {t('risk_by_strategy')}
              <InfoTooltip content={t('risk_strategy_help')} align="left" />
            </div>
            <RiskByStrategy bars={strategyBars} />

            <div className="rg-guide">
              <div className="rg-guide-head"><Lightbulb size={12} />{t('risk_guide_label')}</div>
              <p>{t(`risk_guide_${risk.level}`)}</p>
              <p>{t(`risk_act_${riskTop}`, riskActionVars)}</p>
            </div>
          </PanelBody>
        </Panel>
      </div>

      {/* Top Movers + Positions widget removed in v5.0.6 (duplicated Holdings). */}

      {/* P/L distribution — how many positions are winning vs bleeding */}
      <Panel>
        <PanelHead title={t('dash_pl_distribution')} meta={t('dash_pl_distribution_meta')} />
        <PanelBody>
          <PlHistogram items={withWeight.map(h => ({ unrealizedPlPct: h.unrealizedPlPct }))} />
        </PanelBody>
      </Panel>
    </div>
  )
}
