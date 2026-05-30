'use client'

import { useEffect, useState, useCallback } from 'react'
import { Eye, Plus, X, RefreshCw } from 'lucide-react'
import { createClient }    from '@/lib/supabase/client'
import { useI18n }         from '@/lib/i18n/context'
import { stockName }       from '@/lib/portfolio/stock-names'
import { fmt }             from '@/lib/utils/format'
import { normalizeSymbol } from '@/lib/market/symbol-normalizer'
import {
  computeWatchStatus,
  WATCH_STATUS_TONE,
  type WatchDirection,
} from '@/lib/portfolio/watchlist-status'
import { Panel, PanelBody } from '@/components/ui/panel'
import { EmptyState }       from '@/components/ui/empty-state'
import { SymCell }          from '@/components/brand/stock-logo'

interface WatchItem {
  id:               string
  symbol:           string
  symbolNormalized: string
  name:             string | null
  target:           number
  direction:        WatchDirection | null
  notes:            string | null
}

function normalizeOrRaw(raw: string): string {
  try {
    return normalizeSymbol(raw)
  } catch {
    return raw.trim().toUpperCase()
  }
}

export default function WatchlistPage() {
  const { t, lang } = useI18n()
  const supabase = createClient()

  const [watchlistId, setWatchlistId] = useState<string | null>(null)
  const [items,   setItems]   = useState<WatchItem[]>([])
  const [quotes,  setQuotes]  = useState<Map<string, number>>(new Map())
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Add form
  const [fSymbol, setFSymbol] = useState('')
  const [fTarget, setFTarget] = useState('')
  const [fNotes,  setFNotes]  = useState('')
  const [adding,  setAdding]  = useState(false)
  const [addErr,  setAddErr]  = useState('')

  /* ── Fetch quotes for a set of normalized symbols ───────── */
  const fetchQuotes = useCallback(async (symbols: string[], skipCache = false) => {
    if (!symbols.length) return
    try {
      const res  = await fetch('/api/quotes', {
        method:  'POST',
        headers: { 'content-type': 'application/json' },
        body:    JSON.stringify({ symbols, skipCache }),
      })
      const json = await res.json()
      if (json.quotes) {
        setQuotes(prev => {
          const next = new Map(prev)
          for (const q of json.quotes as Array<{ symbol: string; price: number }>) {
            next.set(q.symbol, q.price)
          }
          return next
        })
      }
    } catch { /* keep last known */ }
  }, [])

  /* ── Load (get-or-create default watchlist + items) ─────── */
  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Get-or-create default watchlist
      const { data: wls } = await supabase
        .from('watchlists').select('id').eq('user_id', user.id).limit(1)
      let wid = wls?.[0]?.id as string | undefined
      if (!wid) {
        const { data: created } = await supabase
          .from('watchlists')
          .insert({ user_id: user.id, name: 'My Watchlist' })
          .select('id').single()
        wid = created?.id
      }
      setWatchlistId(wid ?? null)

      const { data: rows } = await supabase
        .from('watchlist_items')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })

      const mapped: WatchItem[] = (rows ?? []).map(r => ({
        id:               r.id,
        symbol:           r.symbol,
        symbolNormalized: r.symbol_normalized,
        name:             r.name,
        target:           Number(r.alert_price),
        direction:        r.alert_direction,
        notes:            r.notes,
      }))
      setItems(mapped)
      setLoading(false)

      if (mapped.length) fetchQuotes(mapped.map(i => i.symbolNormalized))
    }
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Manual refresh ─────────────────────────────────────── */
  async function refreshAll() {
    if (refreshing || !items.length) return
    setRefreshing(true)
    await fetchQuotes(items.map(i => i.symbolNormalized), true)   // force fresh
    setRefreshing(false)
  }

  /* ── Add a symbol ───────────────────────────────────────── */
  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setAddErr('')

    const target = parseFloat(fTarget)
    if (!fSymbol.trim())               { setAddErr(t('watch_err_symbol')); return }
    if (!Number.isFinite(target) || target <= 0) { setAddErr(t('watch_err_target')); return }

    const normalized = normalizeOrRaw(fSymbol)
    if (items.some(i => i.symbolNormalized === normalized)) {
      setAddErr(t('watch_err_dup')); return
    }

    setAdding(true)
    try {
      // Validate symbol + get current price to infer direction
      const res  = await fetch('/api/quotes', {
        method:  'POST',
        headers: { 'content-type': 'application/json' },
        body:    JSON.stringify({ symbols: [normalized] }),
      })
      const json  = await res.json()
      const quote = (json.quotes as Array<{ symbol: string; price: number }> | undefined)?.[0]
      if (!quote || !(quote.price > 0)) { setAddErr(t('watch_err_symbol')); setAdding(false); return }

      const direction: WatchDirection = target >= quote.price ? 'above' : 'below'

      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !watchlistId) { setAdding(false); return }

      const { data: inserted, error } = await supabase
        .from('watchlist_items')
        .insert({
          watchlist_id:      watchlistId,
          user_id:           user.id,
          symbol:            fSymbol.trim().toUpperCase(),
          symbol_normalized: normalized,
          alert_price:       target,
          alert_direction:   direction,
          notes:             fNotes.trim() || null,
        })
        .select('*').single()

      if (error || !inserted) {
        // 23505 = unique violation → already on the list; otherwise a real failure.
        setAddErr(error?.code === '23505' ? t('watch_err_dup') : t('error_generic'))
        setAdding(false); return
      }

      setItems(prev => [...prev, {
        id:               inserted.id,
        symbol:           inserted.symbol,
        symbolNormalized: inserted.symbol_normalized,
        name:             inserted.name,
        target:           Number(inserted.alert_price),
        direction:        inserted.alert_direction,
        notes:            inserted.notes,
      }])
      setQuotes(prev => new Map(prev).set(normalized, quote.price))
      setFSymbol(''); setFTarget(''); setFNotes('')
    } catch {
      setAddErr(t('watch_err_symbol'))
    } finally {
      setAdding(false)
    }
  }

  /* ── Remove ─────────────────────────────────────────────── */
  async function handleRemove(id: string) {
    setItems(prev => prev.filter(i => i.id !== id))
    await supabase.from('watchlist_items').delete().eq('id', id)
  }

  /* ── Derived: enrich with live status ───────────────────── */
  const enriched = items.map(i => {
    const current = quotes.get(i.symbolNormalized) ?? 0
    const s = computeWatchStatus(current, i.target, i.direction)
    return { ...i, current, ...s }
  })

  const nearCount      = enriched.filter(e => e.status === 'NEAR_TARGET').length
  const triggeredCount = enriched.filter(e => e.status === 'TRIGGERED').length

  return (
    <div>
      <div className="section-header">
        <div>
          <h1 className="section-title">{t('nav_watchlist')}</h1>
          <p className="section-sub">{t('watchlist_sub')}</p>
        </div>
        {!!items.length && (
          <button onClick={refreshAll} disabled={refreshing} className="btn btn-ghost btn-sm">
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? t('quotes_refreshing') : t('quotes_refresh')}
          </button>
        )}
      </div>

      {/* Summary */}
      {!!items.length && (
        <div className="watch-summary">
          <div className="watch-summary-label">{t('watch_summary')}</div>
          <div className="watch-summary-stats">
            <SummaryStat n={items.length}     label={t('watch_tracked')}   tone="neutral" />
            <SummaryStat n={nearCount}         label={t('watch_near')}      tone="warning" />
            <SummaryStat n={triggeredCount}    label={t('watch_triggered')} tone="accent" />
          </div>
        </div>
      )}

      {/* Add form */}
      <form onSubmit={handleAdd} className="watch-add">
        <input
          value={fSymbol}
          onChange={e => setFSymbol(e.target.value.toUpperCase())}
          placeholder={t('watch_add_symbol')}
          className="input watch-add-symbol"
          aria-label={t('watch_add_symbol')}
        />
        <input
          value={fTarget}
          onChange={e => setFTarget(e.target.value)}
          placeholder={t('watch_add_target')}
          type="number"
          step="any"
          min="0"
          className="input watch-add-target text-mono text-tabular"
          aria-label={t('watch_add_target')}
        />
        <input
          value={fNotes}
          onChange={e => setFNotes(e.target.value)}
          placeholder={t('watch_add_notes')}
          className="input watch-add-notes"
          aria-label={t('watch_add_notes')}
        />
        <button type="submit" disabled={adding} className="btn btn-primary btn-sm">
          {adding ? <span className="auth-spinner" /> : <><Plus size={13} />{t('watch_add_btn')}</>}
        </button>
      </form>
      {addErr && (
        <div className="watch-add-err">{addErr}</div>
      )}

      {/* Table */}
      <Panel>
        <PanelBody flush>
          {loading ? (
            <EmptyState title={t('loading')} />
          ) : !items.length ? (
            <EmptyState
              icon={<Eye size={20} />}
              title={t('watch_empty_title')}
              sub={t('watch_empty_sub')}
            />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t('watch_col_symbol')}</th>
                    <th className="num">{t('watch_col_price')}</th>
                    <th className="num">{t('watch_col_target')}</th>
                    <th className="num">{t('watch_col_distance')}</th>
                    <th>{t('watch_col_status')}</th>
                    <th>{t('watch_col_notes')}</th>
                    <th aria-label="actions" />
                  </tr>
                </thead>
                <tbody>
                  {enriched.map(e => (
                    <tr key={e.id} className="watch-row">
                      <td>
                        <SymCell symbol={e.symbol} name={stockName(e.symbol, e.name, lang)} logoSize={28} />
                      </td>
                      <td className="num text-mono text-tabular td--strong">
                        {e.current > 0 ? fmt.price(e.current) : '—'}
                      </td>
                      <td className="num text-mono text-tabular">
                        <span className="watch-target">
                          <span className={`watch-dir watch-dir--${e.direction ?? 'above'}`}>
                            {e.direction === 'below' ? '▼' : '▲'}
                          </span>
                          {fmt.price(e.target)}
                        </span>
                      </td>
                      <td className="num text-tabular">
                        {e.current <= 0 ? (
                          <span className="text-tertiary">—</span>
                        ) : e.reached ? (
                          <span className="text-positive">{t('watch_dist_reached')}</span>
                        ) : (
                          <span className="text-tertiary">
                            {t('watch_dist_to', { pct: fmt.pct(Math.abs(e.distancePct), 1) })}
                          </span>
                        )}
                      </td>
                      <td>
                        <span className={`badge badge--${WATCH_STATUS_TONE[e.status]}`}>
                          {t(`watch_status_${e.status}`)}
                        </span>
                      </td>
                      <td className="watch-notes-cell">
                        {e.notes
                          ? <span className="watch-notes" title={e.notes}>{e.notes}</span>
                          : <span className="text-quaternary">—</span>}
                      </td>
                      <td className="num">
                        <button
                          onClick={() => handleRemove(e.id)}
                          className="watch-remove-btn"
                          aria-label={t('watch_remove')}
                          title={t('watch_remove')}
                        >
                          <X size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </PanelBody>
      </Panel>
    </div>
  )
}

function SummaryStat({ n, label, tone }: { n: number; label: string; tone: 'neutral'|'warning'|'accent' }) {
  return (
    <div className="watch-summary-stat">
      <span className={`watch-summary-n watch-summary-n--${tone}`}>{n}</span>
      <span className="watch-summary-cap">{label}</span>
    </div>
  )
}
