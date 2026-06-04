'use client'

import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { Upload, RefreshCw, ChevronUp, ChevronDown } from 'lucide-react'
import { createClient }      from '@/lib/supabase/client'
import { useHoldingsStore }  from '@/stores/holdings'
import type { Holding }      from '@/stores/holdings'
import { useMarketStore, selectActiveFxRate } from '@/stores/market'
import { useI18n }           from '@/lib/i18n/context'
import type { Lang }         from '@/lib/i18n/dictionary'
import { stockName }         from '@/lib/portfolio/stock-names'
import { fmt }               from '@/lib/utils/format'
import { Panel, PanelBody } from '@/components/ui/panel'
import { SymCell }           from '@/components/brand/stock-logo'
import { DeltaBadge, DeltaMoney } from '@/components/ui/delta-badge'
import { EmptyState }        from '@/components/ui/empty-state'
import { InfoTooltip }       from '@/components/ui/info-tooltip'
import { classifyStrategy, STRATEGY_TONE } from '@/lib/portfolio/taxonomy'
import { getSector, getSectorColor, sectorKey } from '@/lib/portfolio/sectors'
import { useClock }          from '@/lib/hooks/use-clock'
import { currentUsSession, sessionMove } from '@/lib/market/quote-session'
import type { QuoteSession, SessionMove } from '@/lib/market/quote-session'
import { SessionTag, SessionMoveTag } from '@/components/ui/session-tag'

/* ── Multi-view (v5.0.2) ──────────────────────────────────────
   Presentation-only. Four focused lenses over the SAME data —
   no new fields, no recalculation, no backend. Each view simply
   selects which existing columns are shown. */
type ViewId = 'overview' | 'performance' | 'allocation' | 'trading'
const VIEW_IDS: ViewId[] = ['overview', 'performance', 'allocation', 'trading']

type SortKey =
  | 'symbol' | 'quantity' | 'avgCost' | 'currentPrice'
  | 'marketValue' | 'todayPl' | 'unrealizedPl' | 'unrealizedPlPct'
  | 'realizedPl' | 'totalPl' | 'totalReturnPct' | 'portfolioWeight'
type FilterCurrency = 'ALL' | 'USD' | 'MYR'

/** Holding enriched with display-derived totals (no engine change). */
type EnrichedHolding = Holding & {
  totalPl: number
  totalReturnPct: number
  /** Extended-hours (pre/post) move vs the regular close — display only, NOT Today's P&L. */
  sessionMove: SessionMove | null
}

interface ColumnCtx { t: (key: string) => string; lang: Lang }
interface ColumnDef {
  id: string
  label: string                                        // i18n key
  align: 'left' | 'num'
  sortKey?: SortKey
  cell: (h: EnrichedHolding, ctx: ColumnCtx) => ReactNode
}

const numCell = (v: ReactNode, strong = false) =>
  <span className={`text-mono text-tabular${strong ? ' td--strong' : ''}`}>{v}</span>

/* Column registry — every column the four views can draw from. */
const COLUMNS: Record<string, ColumnDef> = {
  symbol: {
    id: 'symbol', label: 'holdings_symbol', align: 'left', sortKey: 'symbol',
    cell: (h, { t, lang }) => (
      <Link
        href={`/holdings/${encodeURIComponent(h.symbolNormalized)}`}
        className="holdings-sym-link"
        title={t('pos_open_hub')}
      >
        <SymCell symbol={h.symbol} name={stockName(h.symbol, h.name, lang)} currency={h.currency} logoSize={28} />
      </Link>
    ),
  },
  quantity: {
    id: 'quantity', label: 'holdings_qty', align: 'num', sortKey: 'quantity',
    cell: h => numCell(fmt.qty(h.quantity)),
  },
  avgCost: {
    id: 'avgCost', label: 'holdings_avg_cost', align: 'num', sortKey: 'avgCost',
    cell: h => numCell(fmt.price(h.avgCost)),
  },
  currentPrice: {
    id: 'currentPrice', label: 'holdings_price', align: 'num', sortKey: 'currentPrice',
    cell: h => (
      <div className="price-cell">
        {numCell(fmt.price(h.currentPrice), true)}
        {h.sessionMove && <SessionMoveTag data={h.sessionMove} />}
      </div>
    ),
  },
  marketValue: {
    id: 'marketValue', label: 'holdings_value', align: 'num', sortKey: 'marketValue',
    cell: h => numCell(fmt.money(h.marketValue, h.currency), true),
  },
  weight: {
    id: 'weight', label: 'holdings_weight', align: 'num', sortKey: 'portfolioWeight',
    cell: h => <span className="text-tabular text-tertiary">{fmt.pct(h.portfolioWeight, 1)}</span>,
  },
  todayPl: {
    id: 'todayPl', label: 'holdings_today_pl', align: 'num', sortKey: 'todayPl',
    cell: h => <DeltaMoney value={h.todayPl} currency={h.currency} variant="inline" />,
  },
  unrealizedPl: {
    id: 'unrealizedPl', label: 'holdings_unreal_pl', align: 'num', sortKey: 'unrealizedPl',
    cell: h => <DeltaMoney value={h.unrealizedPl} currency={h.currency} variant="inline" />,
  },
  unrealizedPlPct: {
    id: 'unrealizedPlPct', label: 'holdings_unreal_pct', align: 'num', sortKey: 'unrealizedPlPct',
    cell: h => <DeltaBadge value={h.unrealizedPlPct} variant="pill" />,
  },
  realizedPl: {
    id: 'realizedPl', label: 'holdings_real_pl', align: 'num', sortKey: 'realizedPl',
    cell: h => <DeltaMoney value={h.realizedPl} currency={h.currency} variant="inline" />,
  },
  totalPl: {
    id: 'totalPl', label: 'holdings_total_pl', align: 'num', sortKey: 'totalPl',
    cell: h => <DeltaMoney value={h.totalPl} currency={h.currency} variant="inline" />,
  },
  totalReturnPct: {
    id: 'totalReturnPct', label: 'holdings_total_return', align: 'num', sortKey: 'totalReturnPct',
    cell: h => <DeltaBadge value={h.totalReturnPct} variant="pill" />,
  },
  strategy: {
    id: 'strategy', label: 'col_strategy', align: 'left',
    cell: (h, { t }) => {
      const strategy = classifyStrategy({
        symbol: h.symbol, name: h.name, assetType: h.assetType,
        unrealizedPlPct: h.unrealizedPlPct, portfolioWeight: h.portfolioWeight,
      })
      return <span className={`badge badge--${STRATEGY_TONE[strategy]}`}>{t(`tax_${strategy}`)}</span>
    },
  },
  sector: {
    id: 'sector', label: 'holdings_sector', align: 'left',
    cell: (h, { t }) => {
      const sec = getSector(h.symbol, h.assetType)
      return (
        <span className="sector-cell">
          <span className="sector-dot" style={{ background: getSectorColor(sec) }} />
          {t(sectorKey(sec))}
        </span>
      )
    },
  },
}

/* Which columns each view shows, in order. */
const VIEWS: Record<ViewId, string[]> = {
  overview:    ['symbol', 'marketValue', 'weight', 'todayPl', 'totalPl'],
  performance: ['symbol', 'unrealizedPl', 'unrealizedPlPct', 'realizedPl', 'totalPl', 'totalReturnPct'],
  allocation:  ['symbol', 'weight', 'marketValue', 'strategy', 'sector'],
  trading:     ['symbol', 'quantity', 'avgCost', 'currentPrice', 'todayPl'],
}

/* Default sort per view — keeps the active sort column always visible. */
const VIEW_DEFAULT_SORT: Record<ViewId, SortKey> = {
  overview:    'marketValue',
  performance: 'totalPl',
  allocation:  'portfolioWeight',
  trading:     'todayPl',
}

/* Session honesty banner (v5.0.3) — shown when the US market is not in
   regular hours, so prices are never silently implied to be live. */
const SESSION_BANNER_KEY: Record<QuoteSession, string> = {
  REGULAR:         '',
  PRE_MARKET:      'sess_banner_pre',
  POST_MARKET:     'sess_banner_post',
  OVERNIGHT_CLOSE: 'sess_banner_close',
}

// Active FX rate is read from market store. Default manual rate is 4.00.
// This fallback is only used if the store hasn't hydrated yet (first paint).
const FX_FALLBACK = 4.00

export default function HoldingsPage() {
  const { t, lang } = useI18n()
  const supabase = createClient()
  const {
    holdings, setHoldings,
    lastImportAt, setLastImport,
    quoteRefreshing, setRefreshing, updateQuotes,
  } = useHoldingsStore()
  const quotes           = useHoldingsStore(s => s.quotes)
  const setQuotesUpdated = useMarketStore(s => s.setQuotesUpdated)
  const fxRate           = useMarketStore(selectActiveFxRate)

  // Session honesty (v5.0.3): tick every 30s so the banner follows the US clock.
  useClock(30_000)
  const usSession = currentUsSession()

  const fileRef = useRef<HTMLInputElement>(null)
  const [dragging,  setDragging]  = useState(false)
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState('')
  const [importErr, setImportErr] = useState(false)
  const [view,      setView]      = useState<ViewId>('overview')
  const [sortKey,   setSortKey]   = useState<SortKey>('marketValue')
  const [sortAsc,   setSortAsc]   = useState(false)
  const [filterCur, setFilterCur] = useState<FilterCurrency>('ALL')
  const [search,    setSearch]    = useState('')

  /* ── Load existing holdings ─────────────────────────────── */
  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase.from('holdings').select('*').eq('user_id', user.id)

      if (data) {
        setHoldings(data.map(row => ({
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
        })))
      }

      const { data: session } = await supabase
        .from('import_sessions')
        .select('imported_at')
        .eq('user_id', user.id)
        .order('imported_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (session) setLastImport(session.imported_at)
    }
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /* ── CSV import (restyled, workflow unchanged) ──────────── */
  async function importCSV(file: File) {
    setImporting(true)
    setImportMsg('')
    setImportErr(false)
    try {
      const form = new FormData()
      form.append('file', file)
      const res  = await fetch('/api/import', { method: 'POST', body: form })
      const json = await res.json()

      if (!res.ok) {
        const detail = json.details ?? json.detail
        throw new Error(detail ? `${json.error}: ${detail}` : (json.error ?? 'Import failed'))
      }

      setImportMsg(t('holdings_import_ok', { n: json.imported }))
      setLastImport(new Date().toISOString())

      // Reload holdings
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase.from('holdings').select('*').eq('user_id', user.id)
        if (data) setHoldings(data.map(row => ({
          id: row.id, symbol: row.symbol, symbolNormalized: row.symbol_normalized,
          name: row.name ?? row.symbol, quantity: Number(row.quantity),
          availableQty: Number(row.available_qty ?? row.quantity), avgCost: Number(row.avg_cost),
          currentPrice: Number(row.current_price ?? row.avg_cost),
          marketValue: Number(row.market_value ?? 0),
          unrealizedPl: Number(row.unrealized_pl ?? 0),
          unrealizedPlPct: Number(row.unrealized_pl_pct ?? 0),
          realizedPl: Number(row.realized_pl ?? 0), todayPl: Number(row.today_pl ?? 0),
          currency: row.currency, assetType: row.asset_type ?? 'US_EQUITY',
          sector: row.sector, targetPrice: row.target_price ? Number(row.target_price) : null,
          stopLoss: row.stop_loss ? Number(row.stop_loss) : null,
          notes: row.notes, portfolioWeight: 0, quotesUpdatedAt: row.quotes_updated_at,
        })))

        // Refresh quotes for imported symbols
        const symbols = (data ?? []).map((r: { symbol_normalized: string }) => r.symbol_normalized)
        if (symbols.length) {
          setRefreshing(true)
          const qRes  = await fetch('/api/quotes', {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ symbols }),
          })
          const qJson = await qRes.json()
          if (qJson.quotes) {
            updateQuotes(qJson.quotes)
            setQuotesUpdated(new Date())
          }
          setRefreshing(false)
        }
      }
    } catch (e: unknown) {
      setImportMsg(t('holdings_import_fail', { msg: (e as Error).message }))
      setImportErr(true)
    } finally {
      setImporting(false)
    }
  }

  /* ── Manual quote refresh ───────────────────────────────── */
  async function refreshAll() {
    if (quoteRefreshing || !holdings.length) return
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
  }

  /* ── View + sort + filter + portfolio weight ────────────── */
  function selectView(v: ViewId) {
    setView(v)
    setSortKey(VIEW_DEFAULT_SORT[v])
    setSortAsc(false)
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(a => !a)
    else { setSortKey(key); setSortAsc(false) }
  }

  const effectiveFx = fxRate > 0 ? fxRate : FX_FALLBACK
  const totalUsd = holdings.reduce((s, h) => {
    const v = h.currency === 'MYR' ? h.marketValue / effectiveFx : h.marketValue
    return s + v
  }, 0)

  const enriched: EnrichedHolding[] = holdings.map(h => {
    const v = h.currency === 'MYR' ? h.marketValue / effectiveFx : h.marketValue
    const totalPl   = h.unrealizedPl + h.realizedPl            // Moomoo 持仓盈亏 = unrealized + realized
    const costBasis = h.avgCost * h.quantity
    const totalReturnPct = costBasis > 0 ? (totalPl / costBasis) * 100 : 0
    return {
      ...h,
      portfolioWeight: totalUsd > 0 ? (v / totalUsd) * 100 : 0,
      totalPl,
      totalReturnPct,
      sessionMove: sessionMove(quotes.get(h.symbolNormalized)),
    }
  })

  const q = search.toUpperCase()
  const filtered = enriched.filter(h =>
    (filterCur === 'ALL' || h.currency === filterCur) &&
    (!search || h.symbol.toUpperCase().includes(q) ||
     (h.name ?? '').toUpperCase().includes(q) ||
     stockName(h.symbol, h.name, lang).toUpperCase().includes(q))
  )

  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0
    switch (sortKey) {
      case 'symbol':          cmp = a.symbol.localeCompare(b.symbol); break
      case 'quantity':        cmp = a.quantity - b.quantity; break
      case 'avgCost':         cmp = a.avgCost - b.avgCost; break
      case 'currentPrice':    cmp = a.currentPrice - b.currentPrice; break
      case 'marketValue':     cmp = a.marketValue - b.marketValue; break
      case 'todayPl':         cmp = a.todayPl - b.todayPl; break
      case 'unrealizedPl':    cmp = a.unrealizedPl - b.unrealizedPl; break
      case 'unrealizedPlPct': cmp = a.unrealizedPlPct - b.unrealizedPlPct; break
      case 'realizedPl':      cmp = a.realizedPl - b.realizedPl; break
      case 'totalPl':         cmp = a.totalPl - b.totalPl; break
      case 'totalReturnPct':  cmp = a.totalReturnPct - b.totalReturnPct; break
      case 'portfolioWeight': cmp = a.portfolioWeight - b.portfolioWeight; break
    }
    return sortAsc ? cmp : -cmp
  })

  const cols = VIEWS[view].map(id => COLUMNS[id])
  const lastImportLabel = lastImportAt ? fmt.relativeTime(lastImportAt, lang) : null

  /* ── Render ─────────────────────────────────────────────── */
  return (
    <div>
      <div className="section-header">
        <div>
          <h1 className="section-title">{t('holdings_title')}</h1>
          {lastImportLabel && (
            <p className="section-sub">
              {t('holdings_last_import')}: {lastImportLabel}
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {!!holdings.length && (
            <button
              onClick={refreshAll}
              disabled={quoteRefreshing}
              className="btn btn-ghost btn-sm"
            >
              <RefreshCw size={13} className={quoteRefreshing ? 'animate-spin' : ''} />
              {quoteRefreshing ? t('quotes_refreshing') : t('quotes_refresh')}
            </button>
          )}
          <button
            onClick={() => fileRef.current?.click()}
            disabled={importing}
            className="btn btn-primary btn-sm"
          >
            <Upload size={13} />
            {importing ? t('holdings_importing') : t('holdings_import')}
          </button>
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept=".csv"
        style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) importCSV(f) }}
      />

      {/* Drop zone — only show if empty */}
      {!holdings.length && (
        <div
          className={`dropzone${dragging ? ' dropzone--over' : ''}`}
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => {
            e.preventDefault(); setDragging(false)
            const f = e.dataTransfer.files?.[0]
            if (f) importCSV(f)
          }}
          onClick={() => fileRef.current?.click()}
          style={{ marginBottom: 18 }}
        >
          <div className="dropzone-icon">
            <Upload size={16} />
          </div>
          <div className="text-secondary" style={{ fontSize: 14, fontWeight: 600 }}>
            {t('holdings_drop_csv')}
          </div>
          <div className="text-tertiary" style={{ fontSize: 12 }}>
            {t('holdings_drop_hint')}
          </div>
        </div>
      )}

      {/* Import status */}
      {importMsg && (
        <div
          className={importErr ? 'auth-error' : ''}
          style={{
            marginBottom: 16,
            padding: '9px 12px',
            borderRadius: 'var(--radius)',
            background: importErr ? 'var(--negative-soft)' : 'var(--positive-soft)',
            border: `1px solid ${importErr ? 'rgba(244,63,94,0.22)' : 'rgba(16,185,129,0.22)'}`,
            color: importErr ? 'var(--negative)' : 'var(--positive)',
            fontSize: 12.5,
          }}
        >
          {importMsg}
        </div>
      )}

      {!!holdings.length && (
        <>
          {/* View switch — four focused lenses over the same positions */}
          <div className="view-switch" role="tablist" aria-label={t('holdings_title')}>
            {VIEW_IDS.map(v => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={view === v}
                className={`view-switch-btn${view === v ? ' view-switch-btn--active' : ''}`}
                onClick={() => selectView(v)}
              >
                {t(`holdings_view_${v}`)}
              </button>
            ))}
          </div>

          {/* Toolbar */}
          <div className="toolbar">
            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('holdings_search_ph')}
              className="input"
              style={{ width: 260, padding: '7px 12px', fontSize: 12.5 }}
            />
            <div className="chip-group">
              {(['ALL', 'USD', 'MYR'] as FilterCurrency[]).map(c => (
                <button
                  key={c}
                  onClick={() => setFilterCur(c)}
                  className={`chip${filterCur === c ? ' chip--active' : ''}`}
                  type="button"
                >
                  {c === 'ALL' ? t('holdings_filter_all') : c}
                </button>
              ))}
            </div>
            <div className="toolbar-spacer" />
            {view === 'allocation' && (
              <span className="th-with-help text-tertiary" style={{ fontSize: 11.5 }}>
                {t('tax_def_title')}
                <InfoTooltip content={
                  <div className="tax-def">
                    <div className="tax-def-title">{t('tax_def_title')}</div>
                    <div className="tax-def-row">{t('tax_CORE_def')}</div>
                    <div className="tax-def-row">{t('tax_TACTICAL_def')}</div>
                    <div className="tax-def-row">{t('tax_SPECULATIVE_def')}</div>
                  </div>
                } />
              </span>
            )}
            <span className="text-tertiary" style={{ fontSize: 11.5 }}>
              {t('holdings_showing', { shown: sorted.length, total: holdings.length })}
            </span>
          </div>

          {/* Session honesty banner (v5.0.3) — never imply a non-live price is live */}
          {usSession !== 'REGULAR' && (
            <div className={`session-banner session-banner--${usSession === 'OVERNIGHT_CLOSE' ? 'close' : usSession === 'PRE_MARKET' ? 'pre' : 'post'}`}>
              <SessionTag session={usSession} />
              <span>{t(SESSION_BANNER_KEY[usSession])}</span>
            </div>
          )}

          {/* Decision workspace table */}
          <Panel>
            <PanelBody flush>
              {!sorted.length ? (
                <EmptyState
                  title={t('empty_no_matches')}
                  sub={t('empty_no_matches_sub')}
                />
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        {cols.map(col => {
                          const isSorted = col.sortKey && sortKey === col.sortKey
                          const cls = [
                            col.align === 'num' ? 'num' : '',
                            col.sortKey ? 'sortable' : '',
                            isSorted ? 'sorted' : '',
                          ].filter(Boolean).join(' ')
                          return (
                            <th
                              key={col.id}
                              className={cls || undefined}
                              onClick={col.sortKey ? () => toggleSort(col.sortKey!) : undefined}
                            >
                              {t(col.label)}
                              {col.sortKey && (
                                <> <SortIcon k={col.sortKey} sortKey={sortKey} sortAsc={sortAsc} /></>
                              )}
                            </th>
                          )
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {sorted.map(h => {
                        const plTone =
                          h.unrealizedPlPct < -25 ? 'negative-strong' :
                          h.unrealizedPlPct >  25 ? 'positive-strong' : undefined
                        return (
                          <tr key={h.id} data-pl-tone={plTone}>
                            {cols.map(col => (
                              <td key={col.id} className={col.align === 'num' ? 'num' : undefined}>
                                {col.cell(h, { t, lang })}
                              </td>
                            ))}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </PanelBody>
          </Panel>
        </>
      )}
    </div>
  )
}

/* ── Sort indicator (extracted — keeps stable identity across renders) ─ */
function SortIcon({ k, sortKey, sortAsc }: { k: SortKey; sortKey: SortKey; sortAsc: boolean }) {
  if (sortKey !== k) return <span className="sort-ind">⇅</span>
  return sortAsc
    ? <ChevronUp size={11} className="sort-ind" />
    : <ChevronDown size={11} className="sort-ind" />
}
