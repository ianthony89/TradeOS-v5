'use client'

import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { Upload, RefreshCw, ChevronUp, ChevronDown, ChevronRight } from 'lucide-react'
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
import { DeltaMoney } from '@/components/ui/delta-badge'
import { EmptyState }        from '@/components/ui/empty-state'
import { classifyStrategy, classifyAction, ACTION_TONE } from '@/lib/portfolio/taxonomy'
import { useClock }          from '@/lib/hooks/use-clock'
import { currentUsSession }  from '@/lib/market/quote-session'
import type { QuoteSession } from '@/lib/market/quote-session'
import { SessionTag }        from '@/components/ui/session-tag'
import { loadAllPositionIntel, loadRecentDecisions } from '@/lib/portfolio/position-intel'
import type { PositionIntel } from '@/lib/portfolio/position-intel'

/* ── v5.0.5 — ONE unified table. No views, no tabs. ─────────── */
type SortKey =
  | 'symbol' | 'marketValue' | 'todayPl' | 'totalPl'
  | 'unrealizedPl' | 'realizedPl' | 'portfolioWeight'
type FilterCurrency = 'ALL' | 'USD' | 'MYR'

/** Holding enriched with display-derived totals (no engine change). */
type EnrichedHolding = Holding & { totalPl: number; totalReturnPct: number }

/** A closed (exited) position — local to this page (store holds open only). */
interface ClosedPos {
  id: string
  symbol: string
  symbolNormalized: string
  name: string
  currency: string
  assetType: string
  realizedPl: number
  exitPrice: number | null    // frozen at close (migration 008)
  exitDate: string | null     // frozen at close
  entryDate: string | null    // holdings.created_at
  thesis: string | null
  lessons: string | null
}

interface ColumnCtx { t: (key: string) => string; lang: Lang }
interface ColumnDef {
  id: string
  label: string
  align: 'left' | 'num'
  sortKey?: SortKey
  cell: (h: EnrichedHolding, ctx: ColumnCtx) => ReactNode
}

const numCell = (v: ReactNode, strong = false) =>
  <span className={`text-mono text-tabular${strong ? ' td--strong' : ''}`}>{v}</span>

const pctText = (pct: number) => `${pct >= 0 ? '+' : '−'}${Math.abs(pct).toFixed(2)}%`

function fmtDate(iso: string | null, lang: Lang): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

/** Money on top, % beneath — Moomoo style, one cell (no extra column). */
function MoneyPct({ value, pct, currency }: { value: number; pct: number; currency: string }) {
  return (
    <div className="cell-stack">
      <DeltaMoney value={value} currency={currency} variant="inline" />
      <span className={`cell-sub cell-sub--${pct >= 0 ? 'up' : 'down'}`}>{pctText(pct)}</span>
    </div>
  )
}

/* The one fixed column set — every position answered in one row. */
const COLS: ColumnDef[] = [
  {
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
  {
    id: 'marketValue', label: 'holdings_value', align: 'num', sortKey: 'marketValue',
    cell: h => numCell(fmt.money(h.marketValue, h.currency), true),
  },
  {
    id: 'todayPl', label: 'holdings_today_pl', align: 'num', sortKey: 'todayPl',
    cell: h => <DeltaMoney value={h.todayPl} currency={h.currency} variant="inline" />,
  },
  {
    id: 'totalPl', label: 'holdings_total_pl', align: 'num', sortKey: 'totalPl',
    cell: h => <MoneyPct value={h.totalPl} pct={h.totalReturnPct} currency={h.currency} />,
  },
  {
    id: 'unrealizedPl', label: 'holdings_unreal_pl', align: 'num', sortKey: 'unrealizedPl',
    cell: h => <MoneyPct value={h.unrealizedPl} pct={h.unrealizedPlPct} currency={h.currency} />,
  },
  {
    id: 'realizedPl', label: 'holdings_real_pl', align: 'num', sortKey: 'realizedPl',
    cell: h => <DeltaMoney value={h.realizedPl} currency={h.currency} variant="inline" />,
  },
  {
    id: 'weight', label: 'holdings_weight', align: 'num', sortKey: 'portfolioWeight',
    cell: h => <span className="text-tabular text-tertiary">{fmt.pct(h.portfolioWeight, 1)}</span>,
  },
  {
    id: 'action', label: 'col_action', align: 'left',
    cell: (h, { t }) => {
      const action = classifyAction({
        symbol: h.symbol, name: h.name, assetType: h.assetType,
        unrealizedPlPct: h.unrealizedPlPct, portfolioWeight: h.portfolioWeight,
      })
      return <span className={`badge badge--${ACTION_TONE[action]}`}>{t(`tax_${action}`)}</span>
    },
  },
]

const SESSION_BANNER_KEY: Record<QuoteSession, string> = {
  REGULAR:         '',
  PRE_MARKET:      'sess_banner_pre',
  POST_MARKET:     'sess_banner_post',
  OVERNIGHT_CLOSE: 'sess_banner_close',
}

const FX_FALLBACK = 4.00

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapRow(row: any): Holding {
  return {
    id: row.id, symbol: row.symbol, symbolNormalized: row.symbol_normalized,
    name: row.name ?? row.symbol, quantity: Number(row.quantity),
    availableQty: Number(row.available_qty ?? row.quantity), avgCost: Number(row.avg_cost),
    currentPrice: Number(row.current_price ?? row.avg_cost), marketValue: Number(row.market_value ?? 0),
    unrealizedPl: Number(row.unrealized_pl ?? 0), unrealizedPlPct: Number(row.unrealized_pl_pct ?? 0),
    realizedPl: Number(row.realized_pl ?? 0), todayPl: Number(row.today_pl ?? 0),
    currency: row.currency, assetType: row.asset_type ?? 'US_EQUITY', sector: row.sector,
    targetPrice: row.target_price ? Number(row.target_price) : null,
    stopLoss: row.stop_loss ? Number(row.stop_loss) : null, notes: row.notes,
    portfolioWeight: 0, quotesUpdatedAt: row.quotes_updated_at,
  }
}

function mapClosed(row: any, piMap: Map<string, PositionIntel>, lessons: Map<string, string>): ClosedPos {
  const sym = row.symbol_normalized
  const intel = piMap.get(sym)
  return {
    id: row.id, symbol: row.symbol, symbolNormalized: sym, name: row.name ?? row.symbol,
    currency: row.currency, assetType: row.asset_type ?? 'US_EQUITY',
    realizedPl: Number(row.realized_pl ?? 0),
    exitPrice: row.exit_price != null ? Number(row.exit_price) : null,
    exitDate: row.exit_date ?? null,
    entryDate: row.created_at ?? null,
    thesis: (intel?.thesis || null),
    lessons: (lessons.get(sym) || intel?.planNotes || null),
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

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

  useClock(30_000)
  const usSession = currentUsSession()

  const fileRef = useRef<HTMLInputElement>(null)
  const [dragging,   setDragging]   = useState(false)
  const [importing,  setImporting]  = useState(false)
  const [importMsg,  setImportMsg]  = useState('')
  const [importErr,  setImportErr]  = useState(false)
  const [sortKey,    setSortKey]    = useState<SortKey>('marketValue')
  const [sortAsc,    setSortAsc]    = useState(false)
  const [filterCur,  setFilterCur]  = useState<FilterCurrency>('ALL')
  const [search,     setSearch]     = useState('')
  const [closedRows, setClosedRows] = useState<ClosedPos[]>([])
  const [expanded,   setExpanded]   = useState<Set<string>>(new Set())
  const [closedOpen, setClosedOpen] = useState(false)   // Closed section collapsed by default (v5.0.6)

  /* ── Full load: holdings + closed (PI/journal) + quotes ──── */
  async function loadAll() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase.from('holdings').select('*').eq('user_id', user.id)
    const rows = data ?? []
    setHoldings(rows.filter(r => Number(r.quantity) > 0).map(mapRow))

    const closedRaw = rows.filter(r => Number(r.quantity) <= 0)
    let piMap = new Map<string, PositionIntel>()
    const lessons = new Map<string, string>()
    if (closedRaw.length) {
      try {
        piMap = await loadAllPositionIntel(supabase, user.id)
        for (const d of await loadRecentDecisions(supabase, user.id, 200)) {
          if (d.symbol && d.body && !lessons.has(d.symbol)) lessons.set(d.symbol, d.body)
        }
      } catch { /* best-effort */ }
    }
    setClosedRows(closedRaw.map(r => mapClosed(r, piMap, lessons)))

    const { data: session } = await supabase
      .from('import_sessions')
      .select('imported_at').eq('user_id', user.id)
      .order('imported_at', { ascending: false }).limit(1).maybeSingle()
    if (session) setLastImport(session.imported_at)

    // Quotes for ALL symbols (open + closed) — closed need a live price for Since-Exit %.
    const allSymbols = rows.map(r => r.symbol_normalized)
    if (allSymbols.length) {
      try {
        const res  = await fetch('/api/quotes', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ symbols: allSymbols }),
        })
        const json = await res.json()
        if (json.quotes) { updateQuotes(json.quotes); setQuotesUpdated(new Date()) }
      } catch { /* keep DB snapshot */ }
    }
  }

  // loadAll() is async — every setState runs after an await, not synchronously.
  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { loadAll() }, [])

  /* ── CSV import (close-in-place lives in /api/import, v5.0.4/5) ── */
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
      setImportMsg(
        json.closed
          ? t('holdings_import_ok_closed', { n: json.imported, c: json.closed })
          : t('holdings_import_ok', { n: json.imported }),
      )
      setLastImport(new Date().toISOString())
      setRefreshing(true)
      await loadAll()
      setRefreshing(false)
    } catch (e: unknown) {
      setImportMsg(t('holdings_import_fail', { msg: (e as Error).message }))
      setImportErr(true)
    } finally {
      setImporting(false)
    }
  }

  /* ── Manual quote refresh (open + closed) ───────────────── */
  async function refreshAll() {
    const symbols = [...holdings.map(h => h.symbolNormalized), ...closedRows.map(c => c.symbolNormalized)]
    if (quoteRefreshing || !symbols.length) return
    setRefreshing(true)
    try {
      const res  = await fetch('/api/quotes', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ symbols, skipCache: true }),
      })
      const json = await res.json()
      if (json.quotes) { updateQuotes(json.quotes); setQuotesUpdated(new Date()) }
    } catch { /* swallow */ }
    finally { setRefreshing(false) }
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(a => !a)
    else { setSortKey(key); setSortAsc(false) }
  }
  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  /* ── Derived: weights, summary, filter, sort ────────────── */
  const effectiveFx = fxRate > 0 ? fxRate : FX_FALLBACK
  const usd = (v: number, cur: string) => (cur === 'MYR' ? v / effectiveFx : v)

  const totalUsd = holdings.reduce((s, h) => s + usd(h.marketValue, h.currency), 0)
  const sumToday = holdings.reduce((s, h) => s + usd(h.todayPl, h.currency), 0)
  const sumTotal = holdings.reduce((s, h) => s + usd(h.unrealizedPl + h.realizedPl, h.currency), 0)

  const enriched: EnrichedHolding[] = holdings.map(h => {
    const totalPl   = h.unrealizedPl + h.realizedPl
    const costBasis = h.avgCost * h.quantity
    return {
      ...h,
      portfolioWeight: totalUsd > 0 ? (usd(h.marketValue, h.currency) / totalUsd) * 100 : 0,
      totalPl,
      totalReturnPct: costBasis > 0 ? (totalPl / costBasis) * 100 : 0,
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
      case 'marketValue':     cmp = a.marketValue - b.marketValue; break
      case 'todayPl':         cmp = a.todayPl - b.todayPl; break
      case 'totalPl':         cmp = a.totalPl - b.totalPl; break
      case 'unrealizedPl':    cmp = a.unrealizedPl - b.unrealizedPl; break
      case 'realizedPl':      cmp = a.realizedPl - b.realizedPl; break
      case 'portfolioWeight': cmp = a.portfolioWeight - b.portfolioWeight; break
    }
    return sortAsc ? cmp : -cmp
  })

  const hasOpen   = holdings.length > 0
  const hasClosed = closedRows.length > 0
  const lastImportLabel = lastImportAt ? fmt.relativeTime(lastImportAt, lang) : null

  /* ── Render ─────────────────────────────────────────────── */
  return (
    <div>
      <div className="section-header">
        <div>
          <h1 className="section-title">{t('holdings_title')}</h1>
          {lastImportLabel && (
            <p className="section-sub">{t('holdings_last_import')}: {lastImportLabel}</p>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {(hasOpen || hasClosed) && (
            <button onClick={refreshAll} disabled={quoteRefreshing} className="btn btn-ghost btn-sm">
              <RefreshCw size={13} className={quoteRefreshing ? 'animate-spin' : ''} />
              {quoteRefreshing ? t('quotes_refreshing') : t('quotes_refresh')}
            </button>
          )}
          <button onClick={() => fileRef.current?.click()} disabled={importing} className="btn btn-primary btn-sm">
            <Upload size={13} />
            {importing ? t('holdings_importing') : t('holdings_import')}
          </button>
        </div>
      </div>

      <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) importCSV(f) }} />

      {/* Drop zone — only when truly empty */}
      {!hasOpen && !hasClosed && (
        <div
          className={`dropzone${dragging ? ' dropzone--over' : ''}`}
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files?.[0]; if (f) importCSV(f) }}
          onClick={() => fileRef.current?.click()}
          style={{ marginBottom: 18 }}
        >
          <div className="dropzone-icon"><Upload size={16} /></div>
          <div className="text-secondary" style={{ fontSize: 14, fontWeight: 600 }}>{t('holdings_drop_csv')}</div>
          <div className="text-tertiary" style={{ fontSize: 12 }}>{t('holdings_drop_hint')}</div>
        </div>
      )}

      {importMsg && (
        <div className={importErr ? 'auth-error' : ''} style={{
          marginBottom: 16, padding: '9px 12px', borderRadius: 'var(--radius)',
          background: importErr ? 'var(--negative-soft)' : 'var(--positive-soft)',
          border: `1px solid ${importErr ? 'rgba(244,63,94,0.22)' : 'rgba(16,185,129,0.22)'}`,
          color: importErr ? 'var(--negative)' : 'var(--positive)', fontSize: 12.5,
        }}>{importMsg}</div>
      )}

      {/* Summary bar — Holdings is the primary portfolio screen now */}
      {(hasOpen || hasClosed) && (
        <div className="holdings-summary">
          <div className="summary-stat">
            <div className="summary-stat-label">{t('holdings_sum_value')}</div>
            <div className="summary-stat-value">{fmt.money(totalUsd, 'USD')}</div>
          </div>
          <div className="summary-stat">
            <div className="summary-stat-label">{t('holdings_today_pl')}</div>
            <div className="summary-stat-value"><DeltaMoney value={sumToday} currency="USD" variant="inline" /></div>
          </div>
          <div className="summary-stat">
            <div className="summary-stat-label">{t('holdings_total_pl')}</div>
            <div className="summary-stat-value"><DeltaMoney value={sumTotal} currency="USD" variant="inline" /></div>
          </div>
          <div className="summary-stat">
            <div className="summary-stat-label">{t('holdings_sum_open')}</div>
            <div className="summary-stat-value">{holdings.length}</div>
          </div>
          <div className="summary-stat">
            <div className="summary-stat-label">{t('holdings_sum_closed')}</div>
            <div className="summary-stat-value">{closedRows.length}</div>
          </div>
        </div>
      )}

      {hasOpen && (
        <>
          {/* Toolbar — filters only, NO view tabs */}
          <div className="toolbar">
            <input type="search" value={search} onChange={e => setSearch(e.target.value)}
              placeholder={t('holdings_search_ph')} className="input"
              style={{ width: 260, padding: '7px 12px', fontSize: 12.5 }} />
            <div className="chip-group">
              {(['ALL', 'USD', 'MYR'] as FilterCurrency[]).map(c => (
                <button key={c} onClick={() => setFilterCur(c)} type="button"
                  className={`chip${filterCur === c ? ' chip--active' : ''}`}>
                  {c === 'ALL' ? t('holdings_filter_all') : c}
                </button>
              ))}
            </div>
            <div className="toolbar-spacer" />
            <span className="text-tertiary" style={{ fontSize: 11.5 }}>
              {t('holdings_showing', { shown: sorted.length, total: holdings.length })}
            </span>
          </div>

          {/* Session honesty banner (v5.0.3) */}
          {usSession !== 'REGULAR' && (
            <div className={`session-banner session-banner--${usSession === 'OVERNIGHT_CLOSE' ? 'close' : usSession === 'PRE_MARKET' ? 'pre' : 'post'}`}>
              <SessionTag session={usSession} />
              <span>{t(SESSION_BANNER_KEY[usSession])}</span>
            </div>
          )}

          {/* ONE unified table — sticky Symbol, all columns visible */}
          <Panel>
            <PanelBody flush>
              {!sorted.length ? (
                <EmptyState title={t('empty_no_matches')} sub={t('empty_no_matches_sub')} />
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="data-table holdings-table">
                    <thead>
                      <tr>
                        {COLS.map(col => {
                          const isSorted = col.sortKey && sortKey === col.sortKey
                          const cls = [
                            col.align === 'num' ? 'num' : '',
                            col.sortKey ? 'sortable' : '',
                            isSorted ? 'sorted' : '',
                          ].filter(Boolean).join(' ')
                          return (
                            <th key={col.id} className={cls || undefined}
                              onClick={col.sortKey ? () => toggleSort(col.sortKey!) : undefined}>
                              {t(col.label)}
                              {col.sortKey && <> <SortIcon k={col.sortKey} sortKey={sortKey} sortAsc={sortAsc} /></>}
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
                            {COLS.map(col => (
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

      {/* Closed positions — collapsed by default (v5.0.6), expandable rows */}
      {hasClosed && (
        <div className="closed-section">
          <button
            type="button"
            className="closed-section-head closed-section-toggle"
            onClick={() => setClosedOpen(o => !o)}
            aria-expanded={closedOpen}
          >
            {closedOpen ? <ChevronDown size={14} className="text-tertiary" /> : <ChevronRight size={14} className="text-tertiary" />}
            <span className="closed-section-title">{t('holdings_closed_title')}</span>
            <span className="closed-section-count">{closedRows.length}</span>
          </button>
          {closedOpen && (
            <Panel>
              <PanelBody flush>
                <div style={{ overflowX: 'auto' }}>
                  <table className="data-table holdings-table">
                    <thead>
                      <tr>
                        <th>{t('holdings_symbol')}</th>
                        <th>{t('holdings_exit_date')}</th>
                        <th className="num">{t('holdings_sold_price')}</th>
                        <th className="num">{t('holdings_current_price')}</th>
                        <th className="num">{t('holdings_since_exit')}</th>
                        <th className="num">{t('holdings_real_pl')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {closedRows.map(c => {
                        const live = quotes.get(c.symbolNormalized)?.price ?? null
                        const since = (c.exitPrice && c.exitPrice > 0 && live != null)
                          ? ((live - c.exitPrice) / c.exitPrice) * 100 : null
                        const days = (c.exitDate && c.entryDate)
                          ? Math.max(0, Math.round((+new Date(c.exitDate) - +new Date(c.entryDate)) / 86_400_000))
                          : null
                        const strat = classifyStrategy({
                          symbol: c.symbol, name: c.name, assetType: c.assetType,
                          unrealizedPlPct: 0, portfolioWeight: 0,
                        })
                        const rowOpen = expanded.has(c.id)
                        return (
                          <FragmentRow key={c.id}>
                            <tr className="closed-row-main" onClick={() => toggleExpand(c.id)}>
                              <td>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                  {rowOpen ? <ChevronDown size={13} className="text-tertiary" /> : <ChevronRight size={13} className="text-tertiary" />}
                                  <SymCell symbol={c.symbol} name={stockName(c.symbol, c.name, lang)} currency={c.currency} logoSize={24} />
                                </span>
                              </td>
                              <td className="text-tertiary" style={{ fontSize: 12 }}>{fmtDate(c.exitDate, lang)}</td>
                              <td className="num text-mono text-tabular">{c.exitPrice != null ? fmt.price(c.exitPrice) : '—'}</td>
                              <td className="num text-mono text-tabular">{live != null ? fmt.price(live) : '—'}</td>
                              <td className="num">
                                {since != null
                                  ? <span className={since >= 0 ? 'text-positive' : 'text-negative'}>{pctText(since)}</span>
                                  : <span className="text-quaternary">—</span>}
                              </td>
                              <td className="num"><DeltaMoney value={c.realizedPl} currency={c.currency} variant="inline" /></td>
                            </tr>
                            {rowOpen && (
                              <tr>
                                <td className="closed-expand-cell" colSpan={6}>
                                  <div className="closed-expand">
                                    <Field label={t('holdings_entry_date')}    value={fmtDate(c.entryDate, lang)} />
                                    <Field label={t('holdings_exit_date')}     value={fmtDate(c.exitDate, lang)} />
                                    <Field label={t('holdings_holding_days')}  value={days != null ? t('holdings_days_n', { n: days }) : '—'} />
                                    <Field label={t('holdings_sold_price')}    value={c.exitPrice != null ? fmt.price(c.exitPrice) : '—'} />
                                    <Field label={t('holdings_current_price')} value={live != null ? fmt.price(live) : '—'} />
                                    <Field label={t('holdings_since_exit')}    value={since != null ? pctText(since) : '—'} />
                                    <Field label={t('holdings_real_pl')}       value={fmt.money(c.realizedPl, c.currency)} />
                                    <Field label={t('col_strategy')}           value={t(`tax_${strat}`)} />
                                    <Field label={t('holdings_thesis_short')}  value={c.thesis || '—'} prose />
                                    <Field label={t('holdings_lessons')}       value={c.lessons || '—'} prose />
                                    <div className="closed-expand-prose">
                                      <Link href={`/holdings/${encodeURIComponent(c.symbolNormalized)}`} className="btn btn-ghost btn-sm">
                                        {t('pos_open_hub')}
                                      </Link>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </FragmentRow>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </PanelBody>
            </Panel>
          )}
        </div>
      )}
    </div>
  )
}

/* Fragment wrapper so a closed position can render a main row + an expand row. */
function FragmentRow({ children }: { children: ReactNode }) { return <>{children}</> }

function Field({ label, value, prose = false }: { label: string; value: string; prose?: boolean }) {
  return (
    <div className={`closed-expand-field${prose ? ' closed-expand-prose' : ''}`}>
      <span className="closed-expand-label">{label}</span>
      <span className="closed-expand-value">{value}</span>
    </div>
  )
}

function SortIcon({ k, sortKey, sortAsc }: { k: SortKey; sortKey: SortKey; sortAsc: boolean }) {
  if (sortKey !== k) return <span className="sort-ind">⇅</span>
  return sortAsc
    ? <ChevronUp size={11} className="sort-ind" />
    : <ChevronDown size={11} className="sort-ind" />
}
