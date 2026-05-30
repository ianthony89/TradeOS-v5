'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { RefreshCw, Upload, ArrowRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useHoldingsStore } from '@/stores/holdings'
import { useMarketStore, selectActiveFxRate } from '@/stores/market'
import { useT }           from '@/lib/i18n/context'
import { fmt }            from '@/lib/utils/format'
import { HOT_LIST }       from '@/lib/market/hot-list'
import { Panel, PanelHead, PanelBody } from '@/components/ui/panel'
import { StatCard }       from '@/components/ui/stat-card'
import { DeltaBadge }     from '@/components/ui/delta-badge'
import { EmptyState }     from '@/components/ui/empty-state'
import { ImportCsvButton } from '@/components/ui/import-button'
import { Toast, type ToastData } from '@/components/ui/toast'
import { TickerStrip }    from '@/components/ui/ticker-strip'
import { DonutChart, type DonutSlice } from '@/components/ui/donut-chart'
import { IntelCard }      from '@/components/ui/intel-card'
import { MoversPanel, type MoverItem } from '@/components/ui/movers-panel'
import { RiskByStrategy, type RiskBar } from '@/components/ui/risk-by-strategy'
import { SymCell }        from '@/components/brand/stock-logo'
import { getSector, getSectorColor }  from '@/lib/portfolio/sectors'
import { classifyStrategy, STRATEGY_TONE } from '@/lib/portfolio/taxonomy'
import { buildActionSuggestions } from '@/lib/portfolio/action-center'

/** USD-equivalent of a native amount (MYR ÷ FX). Module-scope = stable. */
function usdEquiv(amt: number, currency: string, fx: number): number {
  return currency === 'MYR' ? amt / fx : amt
}

export default function DashboardPage() {
  const t        = useT()
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
      setHoldings(mapped)
      return mapped
    }
    return []
  }, [supabase, setHoldings])

  useEffect(() => { loadHoldings() }, [loadHoldings])

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
  const { combined, todayPlUsd, unrealizedUsd } = useMemo(() => {
    let c = 0, t = 0, u = 0
    for (const h of live) {
      c += usdEquiv(h.marketValue,  h.currency, fxRate)
      t += usdEquiv(h.todayPl,      h.currency, fxRate)
      u += usdEquiv(h.unrealizedPl, h.currency, fxRate)
    }
    return { combined: c, todayPlUsd: t, unrealizedUsd: u }
  }, [live, fxRate])
  const costUsd = combined - unrealizedUsd

  const toDisplay = (usd: number) => (primaryCurrency === 'USD' ? usd : usd * fxRate)

  const todayPct    = combined > 0 ? (todayPlUsd / combined) * 100 : 0
  const totalPnLPct = costUsd > 0  ? (unrealizedUsd / costUsd) * 100 : 0
  const todayTone   = todayPlUsd > 0 ? 'positive' : todayPlUsd < 0 ? 'negative' : 'neutral'

  /* Hero — primary value + converted secondary */
  const heroPrimaryValue   = toDisplay(combined)
  const heroSecondaryValue = primaryCurrency === 'USD' ? combined * fxRate : combined
  const heroSecondaryCurr  = primaryCurrency === 'USD' ? 'MYR' : 'USD'

  /* Weight in USD-equivalent terms */
  const withWeight = useMemo(() =>
    live.map(h => {
      const usdValue = h.currency === 'MYR' ? h.marketValue / fxRate : h.marketValue
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
        id: h.id, symbol: h.symbol, name: h.name, currency: h.currency,
        unrealizedPl: h.unrealizedPl, unrealizedPlPct: h.unrealizedPlPct,
      }))
    const los: MoverItem[] = sorted
      .filter(h => h.unrealizedPlPct < 0)
      .reverse()
      .slice(0, 3)
      .map(h => ({
        id: h.id, symbol: h.symbol, name: h.name, currency: h.currency,
        unrealizedPl: h.unrealizedPl, unrealizedPlPct: h.unrealizedPlPct,
      }))
    return { winners: wins, losers: los }
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
      .map(([name, value]) => ({
        name,
        value,
        pct:   (value / combined) * 100,
        color: getSectorColor(name),
      }))
      .sort((a, b) => b.pct - a.pct)
  }, [withWeight, combined])

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
      return { name: t(`tax_${cls}`), pct, value, color }
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

  /* Action Center — rules-based suggestions, prioritized, capped at 3 */
  const actions = useMemo(
    () => buildActionSuggestions(
      withWeight.map(h => ({
        symbol: h.symbol, unrealizedPlPct: h.unrealizedPlPct, portfolioWeight: h.portfolioWeight,
      })),
      sectorSlices.map(s => ({ name: s.name, pct: s.pct })),
      (v) => fmt.pct(v, 1),
    ),
    [withWeight, sectorSlices],
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

  const usdCount = holdings.filter(h => h.currency === 'USD').length
  const myrCount = holdings.filter(h => h.currency === 'MYR').length

  /* ── Empty state ─────────────────────────────────────────── */
  if (!holdings.length) {
    return (
      <div>
        <div className="section-header">
          <div>
            <h1 className="section-title">{t('nav_dashboard')}</h1>
            <p className="section-sub">Your portfolio overview will appear here</p>
          </div>
        </div>
        <Panel>
          <PanelBody>
            <EmptyState
              icon={<Upload size={20} />}
              title="No holdings yet"
              sub="Import your broker CSV to populate the dashboard with live positions, P/L and portfolio intelligence."
              actions={
                <a href="/holdings" className="btn btn-primary btn-sm">
                  <Upload size={13} />
                  Import CSV
                </a>
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
            {holdings.length} positions · {usdCount} USD{myrCount ? ` · ${myrCount} MYR` : ''}
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
            <div className="chip-group" role="group" aria-label="Primary currency">
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
            <span>{fmt.moneySigned(toDisplay(todayPlUsd), primaryCurrency)} today</span>
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
            value={fmt.moneySigned(toDisplay(todayPlUsd), primaryCurrency)}
            tone={todayTone}
            sub={<DeltaBadge value={todayPct} variant="pill" />}
          />
          <StatCard
            label={t('dash_unrealized')}
            value={fmt.moneySigned(toDisplay(unrealizedUsd), primaryCurrency)}
            tone={unrealizedUsd > 0 ? 'positive' : unrealizedUsd < 0 ? 'negative' : 'neutral'}
            sub={<DeltaBadge value={totalPnLPct} variant="pill" />}
          />
          <StatCard
            label={t('dash_holdings_count')}
            value={String(holdings.length)}
            sub={
              <span className="text-tertiary">
                {usdCount} USD{myrCount ? ` · ${myrCount} MYR` : ''}
              </span>
            }
          />
          <StatCard
            label="Risk exposure"
            value={fmt.pct(speculativeWeight, 1)}
            tone={
              speculativeWeight > 50 ? 'negative' :
              speculativeWeight > 25 ? 'neutral'  : 'positive'
            }
            sub={<span className="text-tertiary">Speculative weight</span>}
          />
        </div>
      </div>

      {/* Action Center — what deserves attention today */}
      <div className="action-center">
        <div className="action-center-head">
          <span className="action-center-title">{t('action_center')}</span>
          <span className="action-center-sub">{t('action_center_sub')}</span>
        </div>
        {actions.length ? (
          <div className="action-center-list">
            {actions.map(a => (
              <IntelCard
                key={a.key}
                severity={a.priority}
                icon={a.icon}
                title={t(a.titleKey, a.titleVars)}
                detail={t(a.detailKey, a.detailVars)}
              />
            ))}
          </div>
        ) : (
          <div className="action-center-clear">{t('action_center_clear')}</div>
        )}
      </div>

      {/* Allocation donut + Risk by strategy */}
      <div className="grid-2" style={{ marginBottom: 18 }}>
        <Panel>
          <PanelHead title={t('dash_sector_alloc')} meta="By market value" />
          <PanelBody>
            {sectorSlices.length ? (
              <>
                <DonutChart
                  slices={sectorSlices}
                  centerValue={fmt.compact(combined, 'USD')}
                  centerLabel="Market value"
                  size={220}
                  thickness={28}
                />
                <div className="donut-legend">
                  {sectorSlices.map(s => (
                    <div key={s.name} className="donut-legend-item">
                      <span className="donut-legend-dot" style={{ background: s.color }} />
                      <span className="donut-legend-name">{s.name}</span>
                      <span className="donut-legend-pct">{fmt.pct(s.pct, 1)}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-tertiary" style={{ fontSize: 12 }}>
                Allocation will appear once positions load.
              </div>
            )}
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHead title="Risk exposure" meta="By strategy" />
          <PanelBody>
            <RiskByStrategy bars={strategyBars} />
          </PanelBody>
        </Panel>
      </div>

      {/* Top movers (winners + losers) */}
      <div className="grid-2" style={{ marginBottom: 18 }}>
        <Panel>
          <PanelHead title={t('dash_movers')} meta="By unrealized %" />
          <PanelBody>
            <MoversPanel winners={winners} losers={losers} />
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHead
            title="Positions"
            meta={`Top ${topPositions.length} by weight`}
            actions={
              <a href="/holdings" className="btn btn-ghost btn-sm">
                View all
                <ArrowRight size={12} />
              </a>
            }
          />
          <PanelBody flush>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th className="num">Value</th>
                    <th className="num">P/L</th>
                    <th className="num">Weight</th>
                  </tr>
                </thead>
                <tbody>
                  {topPositions.map(h => {
                    const plTone =
                      h.unrealizedPlPct < -25 ? 'negative-strong' :
                      h.unrealizedPlPct >  25 ? 'positive-strong' : undefined
                    return (
                      <tr key={h.id} data-pl-tone={plTone}>
                        <td>
                          <SymCell symbol={h.symbol} name={h.name} currency={h.currency} logoSize={26} />
                        </td>
                        <td className="num text-mono text-tabular td--strong">
                          {fmt.money(h.marketValue, h.currency)}
                        </td>
                        <td className="num">
                          <DeltaBadge value={h.unrealizedPlPct} variant="pill" />
                        </td>
                        <td className="num text-tabular text-tertiary">
                          {fmt.pct(h.portfolioWeight, 1)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </PanelBody>
        </Panel>
      </div>
    </div>
  )
}
