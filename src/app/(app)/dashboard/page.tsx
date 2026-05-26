'use client'

import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react'
import { createClient }         from '@/lib/supabase/client'
import { useHoldingsStore, getTotalValue, getTodayPl, getTotalUnrealizedPl } from '@/stores/holdings'
import type { Holding }         from '@/stores/holdings'
import { useT }                 from '@/lib/i18n/context'

const FX_USD_MYR = 4.72   // fallback; refreshed from API in production

// ── Formatters ────────────────────────────────────────────────
function fmt(n: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style:    'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)
}

function fmtPct(n: number) {
  const sign = n >= 0 ? '+' : ''
  return `${sign}${n.toFixed(2)}%`
}

function plClass(n: number) {
  return n > 0 ? 'positive' : n < 0 ? 'negative' : 'neutral'
}

// ── Sector classifier (simple) ────────────────────────────────
const SECTOR_MAP: Record<string, string> = {
  AAPL:'Technology', NOK:'Technology', AIXI:'Technology',
  CREG:'Utilities',  CETX:'Technology',
  CTNT:'Consumer Disc.',
  AMZE:'Consumer Disc.',
  JUNS:'Healthcare',
  IOBTQ:'Healthcare',
  FBL:'ETF', NOWL:'ETF', CBRG:'ETF',
}

function sectorOf(symbol: string, assetType: string) {
  if (assetType === 'ETF') return 'ETF'
  return SECTOR_MAP[symbol] ?? 'Other'
}

// ── Sector colors ─────────────────────────────────────────────
const SECTOR_COLORS: Record<string, string> = {
  'Technology':     '#6c8ef5',
  'Healthcare':     '#22c55e',
  'ETF':            '#8b5cf6',
  'Consumer Disc.': '#f59e0b',
  'Utilities':      '#3b82f6',
  'Other':          '#6b7280',
}

export default function DashboardPage() {
  const t          = useT()
  const supabase   = createClient()
  const { holdings, setHoldings, quotes, updateQuotes, quoteRefreshing, setRefreshing } = useHoldingsStore()
  const [fxRate,   setFxRate]   = useState(FX_USD_MYR)
  const [maxPosPct, setMaxPosPct] = useState(25)

  // ── Load holdings from Supabase ───────────────────────────
  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('holdings')
        .select('*')
        .eq('user_id', user.id)
        .order('market_value', { ascending: false })

      if (data) {
        setHoldings(data.map(row => ({
          id:               row.id,
          symbol:           row.symbol,
          symbolNormalized: row.symbol_normalized,
          name:             row.name ?? row.symbol,
          quantity:         Number(row.quantity),
          availableQty:     Number(row.available_qty),
          avgCost:          Number(row.avg_cost),
          currentPrice:     Number(row.current_price ?? row.avg_cost),
          marketValue:      Number(row.market_value),
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
          portfolioWeight:  Number(row.market_value ?? 0),  // calculated below
          quotesUpdatedAt:  row.quotes_updated_at,
        })))
      }

      // Load FX rate
      try {
        const res = await fetch('/api/quotes?symbols=USDMYR%3DX')
        const json = await res.json()
        if (json.quotes?.[0]?.price) setFxRate(json.quotes[0].price)
      } catch { /* use fallback */ }
    }
    load()
  }, [])

  // ── Refresh quotes ────────────────────────────────────────
  const refreshQuotes = useCallback(async () => {
    if (!holdings.length || quoteRefreshing) return
    setRefreshing(true)
    try {
      const symbols = holdings.map(h => h.symbolNormalized)
      const res  = await fetch('/api/quotes', {
        method:  'POST',
        headers: { 'content-type': 'application/json' },
        body:    JSON.stringify({ symbols }),
      })
      const json = await res.json()
      if (json.quotes) updateQuotes(json.quotes)
    } catch { /* silent */ }
    finally { setRefreshing(false) }
  }, [holdings, quoteRefreshing])

  // 30-min auto-refresh
  useEffect(() => {
    if (!holdings.length) return
    refreshQuotes()
    const timer = setInterval(refreshQuotes, 30 * 60 * 1000)
    return () => clearInterval(timer)
  }, [holdings.length])

  // ── Derived values ────────────────────────────────────────
  const { usd, myr } = getTotalValue(holdings, fxRate)
  const todayPl      = getTodayPl(holdings)
  const unrealizedPl = getTotalUnrealizedPl(holdings)

  // Apply live quotes to prices
  const enriched = holdings.map(h => {
    const q = quotes.get(h.symbolNormalized)
    return q ? { ...h, currentPrice: q.price } : h
  })

  // Portfolio weight based on combined total
  const combined = usd + (myr / fxRate)
  const withWeight = enriched.map(h => ({
    ...h,
    portfolioWeight: combined > 0
      ? ((h.currency === 'MYR' ? h.marketValue / fxRate : h.marketValue) / combined) * 100
      : 0,
    sector: sectorOf(h.symbol, h.assetType),
  }))

  // Sort by value
  const sorted = [...withWeight].sort((a, b) => {
    const av = a.currency === 'MYR' ? a.marketValue / fxRate : a.marketValue
    const bv = b.currency === 'MYR' ? b.marketValue / fxRate : b.marketValue
    return bv - av
  })

  // Sector buckets
  const sectorMap = new Map<string, number>()
  for (const h of withWeight) {
    const sec = h.sector ?? 'Other'
    const val = h.currency === 'MYR' ? h.marketValue / fxRate : h.marketValue
    sectorMap.set(sec, (sectorMap.get(sec) ?? 0) + val)
  }
  const sectors = [...sectorMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, val]) => ({ name, val, pct: combined > 0 ? (val / combined) * 100 : 0 }))

  // Position alerts
  const positionAlerts = withWeight.filter(h => h.portfolioWeight > maxPosPct)

  // Top gainer / loser
  const byPct  = [...withWeight].sort((a, b) => b.unrealizedPlPct - a.unrealizedPlPct)
  const gainer = byPct[0]
  const loser  = byPct[byPct.length - 1]

  // ── Render ────────────────────────────────────────────────
  if (!holdings.length) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-[var(--muted)]">
        <p className="text-center">{t('dash_no_holdings')}</p>
        <a href="/holdings" className="btn btn-primary">{t('holdings_import')}</a>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="section-header">
        <h1 className="section-title">{t('nav_dashboard')}</h1>
        <button
          onClick={refreshQuotes}
          disabled={quoteRefreshing}
          className="btn btn-ghost btn-sm"
        >
          <RefreshCw size={13} className={quoteRefreshing ? 'animate-spin' : ''} />
          {quoteRefreshing ? t('quotes_refreshing') : t('quotes_refresh')}
        </button>
      </div>

      {/* ── Stat cards ──────────────────────────────────────── */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">{t('dash_total_value')}</div>
          <div className="stat-value">{fmt(usd)}</div>
          <div className="stat-sub text-[var(--muted)]">{fmt(myr, 'MYR')} MYR</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">{t('dash_today_pl')}</div>
          <div className={`stat-value ${plClass(todayPl)}`}>{fmt(todayPl)}</div>
          <div className="stat-sub">USD</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">{t('dash_unrealized')}</div>
          <div className={`stat-value ${plClass(unrealizedPl)}`}>{fmt(unrealizedPl)}</div>
          <div className="stat-sub">USD total</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">{t('dash_holdings_count')}</div>
          <div className="stat-value">{holdings.length}</div>
          <div className="stat-sub">positions</div>
        </div>
      </div>

      {/* ── Position alerts ─────────────────────────────────── */}
      {positionAlerts.length > 0 && (
        <div className="card border-[var(--warning)]/40">
          <div className="card-title flex items-center gap-2">
            <AlertTriangle size={12} className="text-[var(--warning)]" />
            {t('dash_position_alerts')}
          </div>
          <div className="space-y-2">
            {positionAlerts.map(h => (
              <div key={h.id} className="flex items-center justify-between text-sm">
                <span className="font-mono font-semibold">{h.symbol}</span>
                <span className="badge badge-warning">
                  {h.portfolioWeight.toFixed(1)}% &gt; {maxPosPct}% limit
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* ── Sector breakdown ────────────────────────────── */}
        <div className="card">
          <div className="card-title">{t('dash_sector_breakdown')}</div>
          <div className="space-y-2">
            {sectors.map(({ name, pct }) => (
              <div key={name} className="flex items-center gap-3">
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: SECTOR_COLORS[name] ?? '#6b7280' }}
                />
                <div className="flex-1 text-sm text-[var(--fg)]">{name}</div>
                <div className="text-sm text-[var(--muted)] w-12 text-right">
                  {pct.toFixed(1)}%
                </div>
                <div className="w-24 bg-[var(--bg3)] rounded-full h-1.5">
                  <div
                    className="h-1.5 rounded-full"
                    style={{
                      width: `${pct}%`,
                      background: SECTOR_COLORS[name] ?? '#6b7280',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Top gainer / loser ──────────────────────────── */}
        <div className="card">
          <div className="card-title">{t('dash_top_gainer')} / {t('dash_top_loser')}</div>
          <div className="space-y-3">
            {gainer && (
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-mono font-semibold text-sm">{gainer.symbol}</div>
                  <div className="text-xs text-[var(--muted)]">{gainer.name}</div>
                </div>
                <span className="badge badge-positive">
                  <TrendingUp size={10} className="mr-1" />
                  {fmtPct(gainer.unrealizedPlPct)}
                </span>
              </div>
            )}
            {loser && loser.id !== gainer?.id && (
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-mono font-semibold text-sm">{loser.symbol}</div>
                  <div className="text-xs text-[var(--muted)]">{loser.name}</div>
                </div>
                <span className="badge badge-negative">
                  <TrendingDown size={10} className="mr-1" />
                  {fmtPct(loser.unrealizedPlPct)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Holdings summary table ───────────────────────── */}
      <div className="card">
        <div className="card-title">{t('holdings_title')}</div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('holdings_symbol')}</th>
                <th>{t('holdings_price')}</th>
                <th className="hidden md:table-cell">{t('holdings_value')}</th>
                <th>{t('holdings_unreal_pl')}</th>
                <th className="hidden md:table-cell">{t('holdings_today_pl')}</th>
                <th className="hidden lg:table-cell">{t('holdings_weight')}</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(h => (
                <tr key={h.id}>
                  <td>
                    <div className="font-mono font-semibold text-sm">{h.symbol}</div>
                    <div className="text-xs text-[var(--muted)] truncate max-w-24">{h.name}</div>
                  </td>
                  <td className="font-mono text-sm">
                    {h.currentPrice.toFixed(h.currentPrice < 1 ? 4 : 2)}
                    <span className="text-xs text-[var(--muted)] ml-1">{h.currency}</span>
                  </td>
                  <td className="hidden md:table-cell font-mono text-sm">
                    {h.marketValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  <td>
                    <span className={`badge ${h.unrealizedPl >= 0 ? 'badge-positive' : 'badge-negative'}`}>
                      {fmtPct(h.unrealizedPlPct)}
                    </span>
                  </td>
                  <td className={`hidden md:table-cell text-sm font-mono ${plClass(h.todayPl)}`}>
                    {h.todayPl >= 0 ? '+' : ''}{h.todayPl.toFixed(2)}
                  </td>
                  <td className="hidden lg:table-cell text-sm text-[var(--muted)]">
                    {h.portfolioWeight.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
