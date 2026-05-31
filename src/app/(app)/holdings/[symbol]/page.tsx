'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Lightbulb, Target, Pencil, Check, X, Plus, Trash2,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useI18n } from '@/lib/i18n/context'
import { fmt } from '@/lib/utils/format'
import { useMarketStore, selectActiveFxRate } from '@/stores/market'
import { useHoldingsStore, getTotalValue, type Holding } from '@/stores/holdings'
import {
  classifyStrategy, classifyAction, STRATEGY_TONE, ACTION_TONE,
} from '@/lib/portfolio/taxonomy'
import { getSector, getSectorColor, sectorKey } from '@/lib/portfolio/sectors'
import { stockName } from '@/lib/portfolio/stock-names'
import { StockLogo } from '@/components/brand/stock-logo'
import * as PI from '@/lib/portfolio/position-intel'

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapRow(row: any): Holding {
  return {
    id: row.id, symbol: row.symbol, symbolNormalized: row.symbol_normalized,
    name: row.name ?? row.symbol, quantity: Number(row.quantity),
    availableQty: Number(row.available_qty ?? row.quantity), avgCost: Number(row.avg_cost),
    currentPrice: Number(row.current_price ?? row.avg_cost),
    marketValue: Number(row.market_value ?? 0), unrealizedPl: Number(row.unrealized_pl ?? 0),
    unrealizedPlPct: Number(row.unrealized_pl_pct ?? 0), realizedPl: Number(row.realized_pl ?? 0),
    todayPl: Number(row.today_pl ?? 0), currency: row.currency,
    assetType: row.asset_type ?? 'US_EQUITY', sector: row.sector,
    targetPrice: row.target_price ? Number(row.target_price) : null,
    stopLoss: row.stop_loss ? Number(row.stop_loss) : null,
    notes: row.notes, portfolioWeight: 0, quotesUpdatedAt: row.quotes_updated_at,
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const TONE_VAR: Record<string, string> = {
  accent: 'var(--accent)', positive: 'var(--positive)',
  warning: 'var(--warning)', negative: 'var(--negative)', neutral: 'var(--text-tertiary)',
}

export default function PositionHubPage() {
  const { lang, t } = useI18n()
  const sb = createClient()
  const params = useParams<{ symbol: string }>()
  const symParam = decodeURIComponent(params.symbol)

  const fxRate       = useMarketStore(selectActiveFxRate)
  const setHoldings  = useHoldingsStore(s => s.setHoldings)

  const [userId,  setUserId]  = useState<string | null>(null)
  const [holding, setHolding] = useState<Holding | null>(null)
  const [openedAt, setOpenedAt] = useState<string | null>(null)
  const [weight,  setWeight]  = useState(0)
  const [intel,   setIntel]   = useState<PI.PositionIntel>(PI.EMPTY_INTEL)
  const [log,     setLog]     = useState<PI.DecisionEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    async function load() {
      const { data: { user } } = await sb.auth.getUser()
      if (!user || !alive) return
      setUserId(user.id)

      const { data: rows } = await sb.from('holdings').select('*').eq('user_id', user.id)
      const mapped  = (rows ?? []).map(mapRow)
      setHoldings(mapped)
      const total   = getTotalValue(mapped, fxRate).combined
      const target  = mapped.find(h => h.symbolNormalized === symParam) ?? null
      const rawRow  = (rows ?? []).find((r: { symbol_normalized: string }) => r.symbol_normalized === symParam)
      if (!alive) return
      setHolding(target)
      setOpenedAt(rawRow?.created_at ?? null)
      if (target) {
        const usdEquiv = target.currency === 'MYR' ? target.marketValue / fxRate : target.marketValue
        setWeight(total > 0 ? (usdEquiv / total) * 100 : 0)
      }

      const pi = await PI.loadPositionIntel(sb, user.id, symParam)
      if (!alive) return
      setIntel(pi ?? { ...PI.EMPTY_INTEL, targetCurrency: target?.currency ?? 'USD' })

      const stored = await PI.loadDecisionLog(sb, user.id, symParam)
      if (!alive) return
      const milestones = PI.synthesizeMilestones({
        openedAt: rawRow?.created_at ?? null,
        thesisUpdatedAt: pi?.thesisUpdatedAt ?? null,
        targetsUpdatedAt: pi?.targetsUpdatedAt ?? null,
      })
      setLog(PI.mergeDecisionLog(stored, milestones))
      setLoading(false)
    }
    load()
    return () => { alive = false }
  }, [symParam]) // eslint-disable-line react-hooks/exhaustive-deps

  async function refreshLog(pi: PI.PositionIntel) {
    if (!userId) return
    const stored = await PI.loadDecisionLog(sb, userId, symParam)
    const milestones = PI.synthesizeMilestones({
      openedAt, thesisUpdatedAt: pi.thesisUpdatedAt, targetsUpdatedAt: pi.targetsUpdatedAt,
    })
    setLog(PI.mergeDecisionLog(stored, milestones))
  }

  if (loading) {
    return <div className="pos-hub"><div className="text-tertiary" style={{ fontSize: 13 }}>{t('pos_loading')}</div></div>
  }
  if (!holding) {
    return (
      <div className="pos-hub">
        <Link href="/holdings" className="pos-back"><ArrowLeft size={15} />{t('pos_back')}</Link>
        <div className="panel" style={{ padding: 28, textAlign: 'center' }}>
          <div className="text-tertiary" style={{ fontSize: 13 }}>{t('pos_not_found', { symbol: symParam })}</div>
        </div>
      </div>
    )
  }

  const sector   = getSector(holding.symbol, holding.assetType)
  const strategy = classifyStrategy({ symbol: holding.symbol, name: holding.name, assetType: holding.assetType, unrealizedPlPct: holding.unrealizedPlPct, portfolioWeight: weight })
  const action   = classifyAction({ symbol: holding.symbol, name: holding.name, assetType: holding.assetType, unrealizedPlPct: holding.unrealizedPlPct, portfolioWeight: weight })
  const cur      = holding.currency
  const pos      = holding.unrealizedPl >= 0

  return (
    <div className="pos-hub">
      <Link href="/holdings" className="pos-back"><ArrowLeft size={15} />{t('pos_back')}</Link>

      {/* HERO — portfolio-centric: my position, not the stock */}
      <div className="panel pos-hero">
        <div className="pos-hero-id">
          <StockLogo symbol={holding.symbol} size={46} />
          <div>
            <div className="pos-hero-sym">{holding.symbol}</div>
            <div className="pos-hero-name">{stockName(holding.symbol, holding.name, lang)}</div>
          </div>
        </div>

        <div className="pos-hero-right">
          <div className="pos-hero-value">{fmt.money(holding.marketValue, cur)}</div>
          <div className={`pos-hero-return ${pos ? 'pos' : 'neg'}`}>
            {pos ? '+' : ''}{fmt.money(holding.unrealizedPl, cur)} · {pos ? '+' : ''}{fmt.pct(holding.unrealizedPlPct, 1)} {t('pos_total_return')}
          </div>
          <div className="pos-hero-market">
            {fmt.money(holding.currentPrice, cur)} · <span className={holding.todayPl >= 0 ? 'pos' : 'neg'}>{holding.todayPl >= 0 ? '+' : ''}{fmt.money(holding.todayPl, cur)} {t('pos_today')}</span>
          </div>
        </div>

        <div className="pos-hero-badges">
          <Badge tone={STRATEGY_TONE[strategy]} label={t(`tax_${strategy}`)} />
          <Badge tone={ACTION_TONE[action]} label={t(`tax_${action}`)} />
          <span className="pos-weight-pill">{fmt.pct(weight, 1)} {t('pos_of_book')}</span>
          <span className="pos-meta-pill"><span className="pos-meta-dot" style={{ background: getSectorColor(sector) }} />{t(sectorKey(sector))}</span>
          <span className="pos-meta-pill">{cur}</span>
        </div>
      </div>

      {/* OVERVIEW */}
      <div className="panel">
        <div className="pos-section-label">{t('pos_overview')}</div>
        <div className="pos-stats">
          <Stat label={t('pos_market_value')} value={fmt.money(holding.marketValue, cur)} sub={t('pos_n_shares', { n: fmt.qty(holding.quantity) })} />
          <Stat label={t('pos_weight')}       value={fmt.pct(weight, 1)} sub={t('pos_of_book')} />
          <Stat label={t('pos_avg_cost')}     value={fmt.money(holding.avgCost, cur)} sub={`→ ${fmt.money(holding.currentPrice, cur)}`} />
          <Stat label={t('pos_current_price')} value={fmt.money(holding.currentPrice, cur)} />
          <Stat label={t('pos_today_pl')}      value={`${holding.todayPl >= 0 ? '+' : ''}${fmt.money(holding.todayPl, cur)}`} tone={holding.todayPl >= 0 ? 'pos' : 'neg'} />
          <Stat label={t('pos_unrealized_pl')} value={`${pos ? '+' : ''}${fmt.money(holding.unrealizedPl, cur)}`} sub={`${pos ? '+' : ''}${fmt.pct(holding.unrealizedPlPct, 1)}`} tone={pos ? 'pos' : 'neg'} />
          <Stat label={t('pos_quantity')}      value={fmt.qty(holding.quantity)} sub={t('pos_n_available', { n: fmt.qty(holding.availableQty) })} />
          <Stat label={t('pos_currency')}      value={cur} />
        </div>
      </div>

      <div className="pos-grid2">
        <ThesisCard intel={intel} t={t} lang={lang}
          onSave={async (f) => {
            if (!userId) return
            await PI.saveThesis(sb, userId, holding.symbol, symParam, f)
            const next = { ...intel, ...f, thesisUpdatedAt: new Date().toISOString() }
            setIntel(next); refreshLog(next)
          }} />

        <TargetCard intel={intel} currency={cur} t={t} lang={lang}
          onSave={async (f) => {
            if (!userId) return
            await PI.saveTargets(sb, userId, holding.symbol, symParam, f)
            const next = { ...intel, ...f, targetsUpdatedAt: new Date().toISOString() }
            setIntel(next); refreshLog(next)
          }} />
      </div>

      <DecisionLog
        log={log} t={t} lang={lang}
        openedLabel={t('pos_log_opened_body', { qty: fmt.qty(holding.quantity), price: fmt.money(holding.avgCost, cur) })}
        onAdd={async (body) => {
          if (!userId || !body.trim()) return
          await PI.addReview(sb, userId, symParam, body.trim())
          refreshLog(intel)
        }}
        onDelete={async (id) => { await PI.deleteDecision(sb, id); refreshLog(intel) }}
      />
    </div>
  )
}

/** "01 Jun 2026" — localized short date for the Decision Log timeline. */
function dateShort(at: string, lang: 'en' | 'zh'): string {
  return new Date(at).toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

// ── Small presentational pieces ───────────────────────────────
function Badge({ tone, label }: { tone: string; label: string }) {
  return <span className="pos-badge" style={{ background: `color-mix(in srgb, ${TONE_VAR[tone]} 14%, transparent)`, color: TONE_VAR[tone] }}>{label}</span>
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'pos' | 'neg' }) {
  return (
    <div className="pos-stat">
      <div className="pos-stat-label">{label}</div>
      <div className={`pos-stat-value text-tabular${tone ? ' ' + tone : ''}`}>{value}</div>
      {sub && <div className="pos-stat-sub text-tabular">{sub}</div>}
    </div>
  )
}

// ── Investment Thesis (display → edit) ────────────────────────
function ThesisCard({ intel, t, lang, onSave }: {
  intel: PI.PositionIntel
  t: (k: string, v?: Record<string, string | number>) => string
  lang: 'en' | 'zh'
  onSave: (f: { thesis: string; bullCase: string; bearCase: string; invalidation: string }) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [d, setD] = useState({ thesis: intel.thesis, bullCase: intel.bullCase, bearCase: intel.bearCase, invalidation: intel.invalidation })

  function startEdit() {
    setD({ thesis: intel.thesis, bullCase: intel.bullCase, bearCase: intel.bearCase, invalidation: intel.invalidation })
    setEditing(true)
  }
  async function save() { setSaving(true); await onSave(d); setSaving(false); setEditing(false) }

  const empty = !intel.thesis && !intel.bullCase && !intel.bearCase && !intel.invalidation

  return (
    <div className="panel">
      <div className="pos-section-label">
        <Lightbulb size={13} />{t('pos_thesis')}
        {intel.thesisUpdatedAt && !editing && <span className="pos-upd">{t('pos_updated', { time: fmt.relativeTime(intel.thesisUpdatedAt, lang) })}</span>}
        {!editing && <button type="button" className="pos-edit-btn" onClick={startEdit}><Pencil size={12} />{empty ? t('pos_add') : t('pos_edit')}</button>}
      </div>

      {editing ? (
        <>
          <Field label={t('pos_thesis_field')} hint={t('pos_thesis_hint')} value={d.thesis} onChange={v => setD({ ...d, thesis: v })} rows={2} />
          <Field label={t('pos_bull')} hint={t('pos_bull_hint')} tone="positive" value={d.bullCase} onChange={v => setD({ ...d, bullCase: v })} rows={2} />
          <Field label={t('pos_bear')} hint={t('pos_bear_hint')} tone="negative" value={d.bearCase} onChange={v => setD({ ...d, bearCase: v })} rows={2} />
          <Field label={t('pos_invalidation')} hint={t('pos_invalidation_hint')} tone="warning" value={d.invalidation} onChange={v => setD({ ...d, invalidation: v })} rows={1} />
          <div className="pos-save-row">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}><X size={13} />{t('pos_cancel')}</button>
            <button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={saving}><Check size={13} />{t('pos_save')}</button>
          </div>
        </>
      ) : empty ? (
        <div className="pos-empty">{t('pos_thesis_empty')}</div>
      ) : (
        <>
          <ReadField label={t('pos_thesis_field')} value={intel.thesis} />
          <ReadField label={t('pos_bull')} tone="positive" value={intel.bullCase} />
          <ReadField label={t('pos_bear')} tone="negative" value={intel.bearCase} />
          <ReadField label={t('pos_invalidation')} tone="warning" value={intel.invalidation} />
        </>
      )}
    </div>
  )
}

// ── Target Planner (display → edit) ───────────────────────────
function TargetCard({ intel, currency, t, lang, onSave }: {
  intel: PI.PositionIntel
  currency: string
  t: (k: string, v?: Record<string, string | number>) => string
  lang: 'en' | 'zh'
  onSave: (f: { targetPrice: number | null; trimAbove: number | null; addBelow: number | null; fairValue: number | null; targetCurrency: string; planNotes: string }) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving]   = useState(false)
  const blank = { targetPrice: s(intel.targetPrice), trimAbove: s(intel.trimAbove), addBelow: s(intel.addBelow), fairValue: s(intel.fairValue), planNotes: intel.planNotes }
  const [d, setD] = useState(blank)

  function startEdit() {
    setD({ targetPrice: s(intel.targetPrice), trimAbove: s(intel.trimAbove), addBelow: s(intel.addBelow), fairValue: s(intel.fairValue), planNotes: intel.planNotes })
    setEditing(true)
  }
  async function save() {
    setSaving(true)
    await onSave({ targetPrice: n(d.targetPrice), trimAbove: n(d.trimAbove), addBelow: n(d.addBelow), fairValue: n(d.fairValue), targetCurrency: currency, planNotes: d.planNotes })
    setSaving(false); setEditing(false)
  }

  const sym   = currency === 'MYR' ? 'RM' : '$'
  const empty = intel.targetPrice == null && intel.trimAbove == null && intel.addBelow == null && intel.fairValue == null && !intel.planNotes

  return (
    <div className="panel">
      <div className="pos-section-label">
        <Target size={13} />{t('pos_planner')}
        {intel.targetsUpdatedAt && !editing && <span className="pos-upd">{t('pos_updated', { time: fmt.relativeTime(intel.targetsUpdatedAt, lang) })}</span>}
        {!editing && <button type="button" className="pos-edit-btn" onClick={startEdit}><Pencil size={12} />{empty ? t('pos_add') : t('pos_edit')}</button>}
      </div>

      {editing ? (
        <>
          <div className="pos-targets">
            <NumField label={t('pos_target_price')} sym={sym} value={d.targetPrice} onChange={v => setD({ ...d, targetPrice: v })} />
            <NumField label={t('pos_fair_value')}   sym={sym} value={d.fairValue}   onChange={v => setD({ ...d, fairValue: v })} />
            <NumField label={t('pos_trim_above')} tone="warning"  sym={sym} value={d.trimAbove} onChange={v => setD({ ...d, trimAbove: v })} />
            <NumField label={t('pos_add_below')}  tone="positive" sym={sym} value={d.addBelow}  onChange={v => setD({ ...d, addBelow: v })} />
          </div>
          <Field label={t('pos_notes')} value={d.planNotes} onChange={v => setD({ ...d, planNotes: v })} rows={2} />
          <div className="pos-save-row">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}><X size={13} />{t('pos_cancel')}</button>
            <button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={saving}><Check size={13} />{t('pos_save')}</button>
          </div>
        </>
      ) : empty ? (
        <div className="pos-empty">{t('pos_planner_empty')}</div>
      ) : (
        <>
          <div className="pos-targets">
            <ReadTarget label={t('pos_target_price')} value={intel.targetPrice} sym={sym} />
            <ReadTarget label={t('pos_fair_value')}   value={intel.fairValue}   sym={sym} />
            <ReadTarget label={t('pos_trim_above')} tone="warning"  value={intel.trimAbove} sym={sym} />
            <ReadTarget label={t('pos_add_below')}  tone="positive" value={intel.addBelow}  sym={sym} />
          </div>
          {intel.planNotes && <ReadField label={t('pos_notes')} value={intel.planNotes} />}
        </>
      )}
    </div>
  )
}

// ── Decision Log ──────────────────────────────────────────────
function DecisionLog({ log, t, lang, openedLabel, onAdd, onDelete }: {
  log: PI.DecisionEntry[]
  t: (k: string, v?: Record<string, string | number>) => string
  lang: 'en' | 'zh'
  openedLabel: string
  onAdd: (body: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [draft, setDraft] = useState('')
  const [busy, setBusy]   = useState(false)

  async function add() {
    if (!draft.trim()) return
    setBusy(true); await onAdd(draft); setBusy(false); setDraft('')
  }

  const KIND: Record<string, { tone: string; key: string }> = {
    opened:         { tone: 'accent',   key: 'pos_log_opened' },
    added:          { tone: 'positive', key: 'pos_log_added' },
    reduced:        { tone: 'warning',  key: 'pos_log_reduced' },
    exited:         { tone: 'negative', key: 'pos_log_exited' },
    thesis_updated: { tone: 'accent',   key: 'pos_log_thesis' },
    target_updated: { tone: 'warning',  key: 'pos_log_target' },
    manual:         { tone: 'neutral',  key: 'pos_log_review' },
    review:         { tone: 'neutral',  key: 'pos_log_review' },
  }

  return (
    <div className="panel">
      <div className="pos-section-label">{t('pos_decision_log')}</div>

      <div className="pos-add-review">
        <input className="pos-field" placeholder={t('pos_log_placeholder')} value={draft}
          onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') add() }} />
        <button type="button" className="btn btn-primary btn-sm" onClick={add} disabled={busy || !draft.trim()}><Plus size={13} />{t('pos_log_add')}</button>
      </div>

      {log.length === 0 ? (
        <div className="pos-empty">{t('pos_log_empty')}</div>
      ) : (
        <div className="pos-timeline">
          {log.map(e => {
            const meta = KIND[e.kind] ?? KIND.manual
            const body = e.synthetic ? (e.kind === 'opened' ? openedLabel : t(`${meta.key}_body`)) : e.body
            return (
              <div key={e.id} className="pos-tl-item">
                <span className="pos-tl-dot" style={{ background: TONE_VAR[meta.tone] }} />
                <div className="pos-tl-head">
                  <span className="pos-tl-date">{dateShort(e.at, lang)}</span>
                  <span className="pos-tl-kind">{t(meta.key)}</span>
                  {!e.synthetic && <button type="button" className="pos-tl-del" onClick={() => onDelete(e.id)} aria-label="Delete"><Trash2 size={12} /></button>}
                </div>
                {body && <div className="pos-tl-body">{body}</div>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Field primitives ──────────────────────────────────────────
function Field({ label, hint, tone, value, onChange, rows = 2 }: {
  label: string; hint?: string; tone?: string; value: string; onChange: (v: string) => void; rows?: number
}) {
  return (
    <div className="pos-field-group">
      <div className="pos-field-head" style={tone ? { color: TONE_VAR[tone] } : undefined}>{label}{hint && <span className="pos-field-hint">{hint}</span>}</div>
      <textarea className="pos-field" rows={rows} value={value} onChange={e => onChange(e.target.value)} />
    </div>
  )
}

function ReadField({ label, tone, value }: { label: string; tone?: string; value: string }) {
  return (
    <div className="pos-read-group">
      <div className="pos-read-label" style={tone ? { color: TONE_VAR[tone] } : undefined}>{label}</div>
      <div className="pos-read-value">{value || <span className="pos-read-empty">—</span>}</div>
    </div>
  )
}

function NumField({ label, tone, sym, value, onChange }: { label: string; tone?: string; sym: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <div className="pos-tgt-label" style={tone ? { color: TONE_VAR[tone] } : undefined}>{label}</div>
      <div className="pos-num-input">
        <span className="pos-num-sym">{sym}</span>
        <input className="pos-field" inputMode="decimal" value={value} onChange={e => onChange(e.target.value)} />
      </div>
    </div>
  )
}

function ReadTarget({ label, tone, value, sym }: { label: string; tone?: string; value: number | null; sym: string }) {
  return (
    <div className="pos-read-tgt">
      <div className="pos-tgt-label" style={tone ? { color: TONE_VAR[tone] } : undefined}>{label}</div>
      <div className="pos-tgt-value text-tabular">{value != null ? `${sym}${value.toFixed(2)}` : <span className="pos-read-empty">—</span>}</div>
    </div>
  )
}

// number <-> string helpers for inputs
function s(v: number | null): string { return v == null ? '' : String(v) }
function n(v: string): number | null { const x = parseFloat(v); return Number.isFinite(x) ? x : null }
