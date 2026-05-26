'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Upload, RefreshCw, ChevronUp, ChevronDown } from 'lucide-react'
import { createClient }      from '@/lib/supabase/client'
import { useHoldingsStore }  from '@/stores/holdings'
import type { Holding }      from '@/stores/holdings'
import { useT }              from '@/lib/i18n/context'

type SortKey = 'symbol' | 'marketValue' | 'unrealizedPlPct' | 'todayPl' | 'portfolioWeight'
type FilterCurrency = 'ALL' | 'USD' | 'MYR'

function plClass(n: number) { return n > 0 ? 'positive' : n < 0 ? 'negative' : 'neutral' }

export default function HoldingsPage() {
  const t        = useT()
  const supabase = createClient()
  const {
    holdings, setHoldings, updateHolding,
    lastImportAt, setLastImport,
    quoteRefreshing, setRefreshing, updateQuotes,
  } = useHoldingsStore()

  const fileRef         = useRef<HTMLInputElement>(null)
  const [dragging, setDragging]     = useState(false)
  const [importing, setImporting]   = useState(false)
  const [importMsg, setImportMsg]   = useState('')
  const [sortKey, setSortKey]       = useState<SortKey>('marketValue')
  const [sortAsc, setSortAsc]       = useState(false)
  const [filterCur, setFilterCur]   = useState<FilterCurrency>('ALL')
  const [editId,  setEditId]        = useState<string | null>(null)
  const [editNote, setEditNote]     = useState('')
  const [editTarget, setEditTarget] = useState('')
  const [editStop, setEditStop]     = useState('')

  // ── Load holdings ─────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('holdings')
        .select('*')
        .eq('user_id', user.id)

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
          portfolioWeight:  0,
          quotesUpdatedAt:  row.quotes_updated_at,
        })))
      }

      // Last import
      const { data: session } = await supabase
        .from('import_sessions')
        .select('imported_at')
        .eq('user_id', user.id)
        .order('imported_at', { ascending: false })
        .limit(1)
        .single()
      if (session) setLastImport(session.imported_at)
    }
    load()
  }, [])

  // ── CSV import ────────────────────────────────────────────
  async function importCSV(file: File) {
    setImporting(true)
    setImportMsg('')
    try {
      const form = new FormData()
      form.append('file', file)
      const res  = await fetch('/api/import', { method: 'POST', body: form })
      const json = await res.json()

      if (!res.ok) throw new Error(json.error ?? 'Import failed')

      setImportMsg(t('holdings_import_ok', { n: json.imported }))
      setLastImport(new Date().toISOString())

      // Reload holdings
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase.from('holdings').select('*').eq('user_id', user.id)
        if (data) setHoldings(data.map(row => ({
          id: row.id, symbol: row.symbol, symbolNormalized: row.symbol_normalized,
          name: row.name ?? row.symbol, quantity: Number(row.quantity),
          availableQty: Number(row.available_qty), avgCost: Number(row.avg_cost),
          currentPrice: Number(row.current_price ?? row.avg_cost),
          marketValue: Number(row.market_value),
          unrealizedPl: Number(row.unrealized_pl ?? 0),
          unrealizedPlPct: Number(row.unrealized_pl_pct ?? 0),
          realizedPl: Number(row.realized_pl ?? 0), todayPl: Number(row.today_pl ?? 0),
          currency: row.currency, assetType: row.asset_type ?? 'US_EQUITY',
          sector: row.sector, targetPrice: row.target_price ? Number(row.target_price) : null,
          stopLoss: row.stop_loss ? Number(row.stop_loss) : null,
          notes: row.notes, portfolioWeight: 0, quotesUpdatedAt: row.quotes_updated_at,
        })))

        // Auto-refresh quotes after import
        const symbols = data.map((r: { symbol_normalized: string }) => r.symbol_normalized)
        const qRes    = await fetch('/api/quotes', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ symbols }),
        })
        const qJson = await qRes.json()
        if (qJson.quotes) updateQuotes(qJson.quotes)
      }
    } catch (e: unknown) {
      setImportMsg(t('holdings_import_fail', { msg: (e as Error).message }))
    } finally {
      setImporting(false)
    }
  }

  // ── Save inline edits ─────────────────────────────────────
  async function saveEdit(h: Holding) {
    const patch = {
      target_price: editTarget ? parseFloat(editTarget) : null,
      stop_loss:    editStop   ? parseFloat(editStop)   : null,
      notes:        editNote   || null,
    }
    await supabase.from('holdings').update(patch).eq('id', h.id)
    updateHolding(h.id, {
      targetPrice: patch.target_price ?? null,
      stopLoss:    patch.stop_loss    ?? null,
      notes:       patch.notes,
    })
    setEditId(null)
  }

  // ── Sort + filter ─────────────────────────────────────────
  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(a => !a)
    else { setSortKey(key); setSortAsc(false) }
  }

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey === k
      ? (sortAsc ? <ChevronUp size={10} /> : <ChevronDown size={10} />)
      : null

  const displayed = holdings
    .filter(h => filterCur === 'ALL' || h.currency === filterCur)
    .sort((a, b) => {
      let cmp = 0
      if (sortKey === 'symbol')         cmp = a.symbol.localeCompare(b.symbol)
      if (sortKey === 'marketValue')    cmp = a.marketValue - b.marketValue
      if (sortKey === 'unrealizedPlPct') cmp = a.unrealizedPlPct - b.unrealizedPlPct
      if (sortKey === 'todayPl')        cmp = a.todayPl - b.todayPl
      if (sortKey === 'portfolioWeight') cmp = a.portfolioWeight - b.portfolioWeight
      return sortAsc ? cmp : -cmp
    })

  const lastImportFmt = lastImportAt
    ? new Date(lastImportAt).toLocaleString()
    : null

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="section-header">
        <div>
          <h1 className="section-title">{t('holdings_title')}</h1>
          {lastImportFmt && (
            <p className="text-xs text-[var(--muted)] mt-0.5">
              {t('holdings_last_import')}: {lastImportFmt}
            </p>
          )}
        </div>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={importing}
          className="btn btn-primary btn-sm"
        >
          <Upload size={13} />
          {importing ? t('holdings_importing') : t('holdings_import')}
        </button>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) importCSV(f) }}
      />

      {/* Upload zone */}
      <div
        className={`upload-zone ${dragging ? 'drag-over' : ''}`}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => {
          e.preventDefault(); setDragging(false)
          const f = e.dataTransfer.files?.[0]
          if (f) importCSV(f)
        }}
        onClick={() => fileRef.current?.click()}
      >
        <Upload size={24} className="mx-auto mb-2 opacity-50" />
        <p className="text-sm">{t('holdings_drop_csv')}</p>
        {importing && <p className="text-xs mt-1 text-[var(--accent)]">{t('holdings_importing')}</p>}
      </div>

      {importMsg && (
        <p className={`text-sm ${importMsg.includes('fail') || importMsg.includes('失败') ? 'text-[var(--negative)]' : 'text-[var(--positive)]'}`}>
          {importMsg}
        </p>
      )}

      {/* Filters */}
      <div className="flex gap-2">
        {(['ALL', 'USD', 'MYR'] as FilterCurrency[]).map(f => (
          <button
            key={f}
            onClick={() => setFilterCur(f)}
            className={`btn btn-sm ${filterCur === f ? 'btn-primary' : 'btn-ghost'}`}
          >
            {f === 'ALL' ? t('holdings_filter_all') : f}
          </button>
        ))}
      </div>

      {/* Table */}
      {!holdings.length ? (
        <div className="card text-center text-[var(--muted)] py-12">
          {t('holdings_no_data')}
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th onClick={() => toggleSort('symbol')}>
                    {t('holdings_symbol')} <SortIcon k="symbol" />
                  </th>
                  <th>{t('holdings_qty')}</th>
                  <th>{t('holdings_avg_cost')}</th>
                  <th>{t('holdings_price')}</th>
                  <th onClick={() => toggleSort('marketValue')}>
                    {t('holdings_value')} <SortIcon k="marketValue" />
                  </th>
                  <th onClick={() => toggleSort('unrealizedPlPct')}>
                    {t('holdings_unreal_pl')} <SortIcon k="unrealizedPlPct" />
                  </th>
                  <th onClick={() => toggleSort('todayPl')} className="hidden md:table-cell">
                    {t('holdings_today_pl')} <SortIcon k="todayPl" />
                  </th>
                  <th className="hidden lg:table-cell">{t('holdings_target')}</th>
                  <th className="hidden lg:table-cell">{t('holdings_stop')}</th>
                  <th className="hidden xl:table-cell">{t('holdings_notes')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {displayed.map(h => (
                  <>
                    <tr key={h.id}>
                      <td>
                        <div className="font-mono font-semibold text-sm">{h.symbol}</div>
                        <div className="text-xs text-[var(--muted)] max-w-28 truncate">{h.name}</div>
                        <div className="text-xs text-[var(--muted)]">{h.currency}</div>
                      </td>
                      <td className="font-mono text-sm">{h.quantity.toLocaleString()}</td>
                      <td className="font-mono text-sm">{h.avgCost.toFixed(h.avgCost < 1 ? 4 : 3)}</td>
                      <td className="font-mono text-sm">{h.currentPrice.toFixed(h.currentPrice < 1 ? 4 : 2)}</td>
                      <td className="font-mono text-sm">{h.marketValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                      <td>
                        <div className={`font-mono text-sm ${plClass(h.unrealizedPl)}`}>
                          {h.unrealizedPl >= 0 ? '+' : ''}{h.unrealizedPl.toFixed(2)}
                        </div>
                        <span className={`badge ${h.unrealizedPlPct >= 0 ? 'badge-positive' : 'badge-negative'}`}>
                          {h.unrealizedPlPct >= 0 ? '+' : ''}{h.unrealizedPlPct.toFixed(2)}%
                        </span>
                      </td>
                      <td className={`hidden md:table-cell font-mono text-sm ${plClass(h.todayPl)}`}>
                        {h.todayPl >= 0 ? '+' : ''}{h.todayPl.toFixed(2)}
                      </td>
                      <td className="hidden lg:table-cell text-sm text-[var(--muted)]">
                        {h.targetPrice ? `${h.targetPrice}` : '—'}
                      </td>
                      <td className="hidden lg:table-cell text-sm text-[var(--muted)]">
                        {h.stopLoss ? `${h.stopLoss}` : '—'}
                      </td>
                      <td className="hidden xl:table-cell text-xs text-[var(--muted)] max-w-32 truncate">
                        {h.notes ?? '—'}
                      </td>
                      <td>
                        <button
                          onClick={() => {
                            setEditId(h.id === editId ? null : h.id)
                            setEditNote(h.notes ?? '')
                            setEditTarget(h.targetPrice ? String(h.targetPrice) : '')
                            setEditStop(h.stopLoss ? String(h.stopLoss) : '')
                          }}
                          className="btn btn-ghost btn-sm text-xs"
                        >
                          {t('btn_edit')}
                        </button>
                      </td>
                    </tr>
                    {editId === h.id && (
                      <tr key={`${h.id}-edit`}>
                        <td colSpan={11} className="bg-[var(--bg3)] px-4 py-3">
                          <div className="flex flex-wrap gap-3 items-end">
                            <div>
                              <label className="text-xs text-[var(--muted)] block mb-1">{t('holdings_target')}</label>
                              <input value={editTarget} onChange={e => setEditTarget(e.target.value)}
                                className="input w-32" placeholder="0.00" type="number" step="any" />
                            </div>
                            <div>
                              <label className="text-xs text-[var(--muted)] block mb-1">{t('holdings_stop')}</label>
                              <input value={editStop} onChange={e => setEditStop(e.target.value)}
                                className="input w-32" placeholder="0.00" type="number" step="any" />
                            </div>
                            <div className="flex-1 min-w-48">
                              <label className="text-xs text-[var(--muted)] block mb-1">{t('holdings_notes')}</label>
                              <input value={editNote} onChange={e => setEditNote(e.target.value)}
                                className="input" placeholder="Quick note…" />
                            </div>
                            <button onClick={() => saveEdit(h)} className="btn btn-primary btn-sm">{t('btn_save')}</button>
                            <button onClick={() => setEditId(null)} className="btn btn-ghost btn-sm">{t('btn_cancel')}</button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
