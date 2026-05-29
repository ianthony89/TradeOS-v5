'use client'

import { useEffect, useRef, useState } from 'react'
import { Upload, RefreshCw, ChevronUp, ChevronDown } from 'lucide-react'
import { createClient }      from '@/lib/supabase/client'
import { useHoldingsStore }  from '@/stores/holdings'
import type { Holding }      from '@/stores/holdings'
import { useMarketStore, selectActiveFxRate } from '@/stores/market'
import { useT }              from '@/lib/i18n/context'
import { fmt }               from '@/lib/utils/format'
import { Panel, PanelBody } from '@/components/ui/panel'
import { SymCell }           from '@/components/brand/stock-logo'
import { DeltaBadge, DeltaMoney } from '@/components/ui/delta-badge'
import { EmptyState }        from '@/components/ui/empty-state'
import {
  classifyStrategy, classifyAction,
  STRATEGY_TONE, ACTION_TONE,
} from '@/lib/portfolio/taxonomy'

type SortKey = 'symbol' | 'marketValue' | 'unrealizedPlPct' | 'todayPl' | 'portfolioWeight'
type FilterCurrency = 'ALL' | 'USD' | 'MYR'

// Active FX rate is read from market store. Default manual rate is 4.00.
// This fallback is only used if the store hasn't hydrated yet (first paint).
const FX_FALLBACK = 4.00

export default function HoldingsPage() {
  const t        = useT()
  const supabase = createClient()
  const {
    holdings, setHoldings,
    lastImportAt, setLastImport,
    quoteRefreshing, setRefreshing, updateQuotes,
  } = useHoldingsStore()
  const setQuotesUpdated = useMarketStore(s => s.setQuotesUpdated)
  const fxRate           = useMarketStore(selectActiveFxRate)

  const fileRef = useRef<HTMLInputElement>(null)
  const [dragging,  setDragging]  = useState(false)
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState('')
  const [importErr, setImportErr] = useState(false)
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
        body:    JSON.stringify({ symbols }),
      })
      const json = await res.json()
      if (json.quotes) {
        updateQuotes(json.quotes)
        setQuotesUpdated(new Date())
      }
    } catch { /* swallow */ }
    finally { setRefreshing(false) }
  }

  /* ── Sort + filter + portfolio weight ───────────────────── */
  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(a => !a)
    else { setSortKey(key); setSortAsc(false) }
  }

  const effectiveFx = fxRate > 0 ? fxRate : FX_FALLBACK
  const totalUsd = holdings.reduce((s, h) => {
    const v = h.currency === 'MYR' ? h.marketValue / effectiveFx : h.marketValue
    return s + v
  }, 0)

  const enriched = holdings.map(h => {
    const v = h.currency === 'MYR' ? h.marketValue / effectiveFx : h.marketValue
    return { ...h, portfolioWeight: totalUsd > 0 ? (v / totalUsd) * 100 : 0 }
  })

  const filtered = enriched.filter(h =>
    (filterCur === 'ALL' || h.currency === filterCur) &&
    (!search || h.symbol.toUpperCase().includes(search.toUpperCase()) ||
     (h.name ?? '').toUpperCase().includes(search.toUpperCase()))
  )

  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0
    if (sortKey === 'symbol')          cmp = a.symbol.localeCompare(b.symbol)
    if (sortKey === 'marketValue')     cmp = a.marketValue - b.marketValue
    if (sortKey === 'unrealizedPlPct') cmp = a.unrealizedPlPct - b.unrealizedPlPct
    if (sortKey === 'todayPl')         cmp = a.todayPl - b.todayPl
    if (sortKey === 'portfolioWeight') cmp = a.portfolioWeight - b.portfolioWeight
    return sortAsc ? cmp : -cmp
  })

  const lastImportLabel = lastImportAt ? fmt.relativeTime(lastImportAt) : null

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
            Moomoo / generic broker CSV · symbol, qty, cost, price, currency
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
          {/* Toolbar */}
          <div className="toolbar">
            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search symbol or name…"
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
            <span className="text-tertiary" style={{ fontSize: 11.5 }}>
              {sorted.length} of {holdings.length}
            </span>
          </div>

          {/* Decision workspace table */}
          <Panel>
            <PanelBody flush>
              {!sorted.length ? (
                <EmptyState
                  title="No matches"
                  sub="Try a different search or filter."
                />
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th
                          className={`sortable${sortKey === 'symbol' ? ' sorted' : ''}`}
                          onClick={() => toggleSort('symbol')}
                        >
                          {t('holdings_symbol')} <SortIcon k="symbol" sortKey={sortKey} sortAsc={sortAsc} />
                        </th>
                        <th className="num">{t('holdings_qty')}</th>
                        <th className="num">{t('holdings_avg_cost')}</th>
                        <th className="num">{t('holdings_price')}</th>
                        <th
                          className={`num sortable${sortKey === 'marketValue' ? ' sorted' : ''}`}
                          onClick={() => toggleSort('marketValue')}
                        >
                          {t('holdings_value')} <SortIcon k="marketValue" sortKey={sortKey} sortAsc={sortAsc} />
                        </th>
                        <th
                          className={`num sortable${sortKey === 'todayPl' ? ' sorted' : ''}`}
                          onClick={() => toggleSort('todayPl')}
                        >
                          {t('holdings_today_pl')} <SortIcon k="todayPl" sortKey={sortKey} sortAsc={sortAsc} />
                        </th>
                        <th
                          className={`num sortable${sortKey === 'unrealizedPlPct' ? ' sorted' : ''}`}
                          onClick={() => toggleSort('unrealizedPlPct')}
                        >
                          {t('holdings_unreal_pl')} <SortIcon k="unrealizedPlPct" sortKey={sortKey} sortAsc={sortAsc} />
                        </th>
                        <th
                          className={`num sortable${sortKey === 'portfolioWeight' ? ' sorted' : ''}`}
                          onClick={() => toggleSort('portfolioWeight')}
                        >
                          {t('holdings_weight')} <SortIcon k="portfolioWeight" sortKey={sortKey} sortAsc={sortAsc} />
                        </th>
                        <th>{t('col_strategy')}</th>
                        <th>{t('col_action')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sorted.map(h => <Row key={h.id} h={h} t={t} />)}
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

/* ── Single holdings row ───────────────────────────────────── */
function Row({ h, t }: { h: Holding; t: (key: string) => string }) {
  const classifyInput = {
    symbol:          h.symbol,
    name:            h.name,
    assetType:       h.assetType,
    unrealizedPlPct: h.unrealizedPlPct,
    portfolioWeight: h.portfolioWeight,
  }
  const strategy = classifyStrategy(classifyInput)
  const action   = classifyAction(classifyInput)
  const plTone   =
    h.unrealizedPlPct < -25 ? 'negative-strong' :
    h.unrealizedPlPct >  25 ? 'positive-strong' : undefined
  return (
    <tr data-pl-tone={plTone}>
      <td>
        <SymCell symbol={h.symbol} name={h.name} currency={h.currency} logoSize={28} />
      </td>
      <td className="num text-mono text-tabular">{fmt.qty(h.quantity)}</td>
      <td className="num text-mono text-tabular">{fmt.price(h.avgCost)}</td>
      <td className="num text-mono text-tabular td--strong">{fmt.price(h.currentPrice)}</td>
      <td className="num text-mono text-tabular td--strong">
        {fmt.money(h.marketValue, h.currency)}
      </td>
      <td className="num">
        <DeltaMoney value={h.todayPl} currency={h.currency} variant="inline" />
      </td>
      <td className="num">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
          <DeltaMoney value={h.unrealizedPl} currency={h.currency} variant="inline" />
          <DeltaBadge value={h.unrealizedPlPct} variant="pill" />
        </div>
      </td>
      <td className="num text-tabular text-tertiary">
        {fmt.pct(h.portfolioWeight, 1)}
      </td>
      <td>
        <span className={`badge badge--${STRATEGY_TONE[strategy]}`}>
          {t(`tax_${strategy}`)}
        </span>
      </td>
      <td>
        <span className={`badge badge--${ACTION_TONE[action]}`}>
          {t(`tax_${action}`)}
        </span>
      </td>
    </tr>
  )
}
