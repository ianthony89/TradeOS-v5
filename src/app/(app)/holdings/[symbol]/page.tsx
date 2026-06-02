'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Lightbulb, Target, Pencil, Check, X, Plus, Trash2,
  TrendingUp, TrendingDown, AlertTriangle, ArrowUp, ArrowDown,
  Flag, Minus, LogOut, FileText, MessageSquare, Scale, type LucideIcon,
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
import { THESIS_TYPES, thesisTemplate, type ThesisType } from '@/lib/portfolio/thesis-templates'
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
  accent: 'var(--accent)', accent2: 'var(--accent-2)', positive: 'var(--positive)',
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
  const rs       = reviewStatus(intel.nextReviewAt)

  // Position quality — front-end completeness signal (no AI, no backend).
  const q = {
    thesis:     !!(intel.thesis || intel.bullCase || intel.bearCase || intel.invalidation),
    plan:       intel.targetPrice != null || intel.trimAbove != null || intel.addBelow != null || intel.fairValue != null,
    conviction: !!intel.confidence,
    review:     intel.reviewFrequencyDays != null,
  }
  const qScore = [q.thesis, q.plan, q.conviction, q.review].filter(Boolean).length
  const qTone  = qScore >= 4 ? 'positive' : qScore >= 2 ? 'accent' : 'warning'
  const qGrade = qScore === 4 ? 'A+' : qScore === 3 ? 'A' : qScore === 2 ? 'B' : 'C'
  const qMissingList = [
    !q.thesis     && t('pos_q_thesis'),
    !q.plan       && t('pos_q_plan'),
    !q.conviction && t('pos_conviction'),
    !q.review     && t('pos_q_review'),
  ].filter(Boolean) as string[]
  const qMissing = qMissingList.length === 0 ? t('pos_q_complete')
    : qMissingList.length === 1 ? t('pos_missing_one', { item: qMissingList[0] })
    : t('pos_missing_n', { n: qMissingList.length })
  const qTip = `${q.thesis ? '✓' : '○'} ${t('pos_q_thesis')}   ${q.plan ? '✓' : '○'} ${t('pos_q_plan')}   ${q.conviction ? '✓' : '○'} ${t('pos_conviction')}   ${q.review ? '✓' : '○'} ${t('pos_q_review')}`

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
        </div>

        <div className="pos-hero-badges">
          <Badge tone={STRATEGY_TONE[strategy]} label={t(`tax_${strategy}`)} />
          <Badge tone={ACTION_TONE[action]} label={t(`tax_${action}`)} />
          <HeroConviction value={intel.confidence} t={t}
            onSet={async (c) => {
              if (!userId) return
              setIntel({ ...intel, confidence: c })
              await PI.saveMeta(sb, userId, holding.symbol, symParam, { confidence: c })
            }} />
          {rs && <Badge tone={rs.tone} label={t(`pos_rev_${rs.key}`)} />}
          <span className="pos-weight-pill">{fmt.pct(weight, 1)} {t('pos_of_book')}</span>
          <span className="pos-meta-pill"><span className="pos-meta-dot" style={{ background: getSectorColor(sector) }} />{t(sectorKey(sector))}</span>
          <span className="pos-meta-pill">{cur}</span>
        </div>

        {/* secondary market metrics — present but clearly subordinate */}
        <div className="pos-hero-metrics">
          <HeroMetric label={t('pos_current_price')} value={fmt.money(holding.currentPrice, cur)} />
          <HeroMetric label={t('pos_avg_cost')}      value={fmt.money(holding.avgCost, cur)} />
          <HeroMetric label={t('pos_today_pl')}       value={`${holding.todayPl >= 0 ? '+' : ''}${fmt.money(holding.todayPl, cur)}`} tone={holding.todayPl >= 0 ? 'pos' : 'neg'} />
          <div className="pos-hero-metric" title={qTip}>
            <div className="pos-hero-metric-label">{t('pos_quality')}</div>
            <div className="pos-quality">
              <span className="pos-quality-grade" style={{ color: TONE_VAR[qTone] }}>{qGrade}</span>
              <span className="pos-quality-miss">{qMissing}</span>
            </div>
          </div>
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

        <TargetCard intel={intel} currency={cur} currentPrice={holding.currentPrice} t={t} lang={lang}
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
        freq={intel.reviewFrequencyDays} nextReviewAt={intel.nextReviewAt}
        onReview={async (days) => {
          if (!userId) return
          const next = PI.computeNextReview(days)
          setIntel({ ...intel, reviewFrequencyDays: days, nextReviewAt: next })
          await PI.saveMeta(sb, userId, holding.symbol, symParam, { reviewFrequencyDays: days, nextReviewAt: next })
        }}
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

/** Hero review signal from the scheduled next-review date. null = no cadence. */
function reviewStatus(nextReviewAt: string | null): { key: string; tone: string } | null {
  if (!nextReviewAt) return null
  const diff = new Date(nextReviewAt).getTime() - Date.now()
  if (diff < 0)                 return { key: 'due',  tone: 'negative' }
  if (diff < 7 * 86_400_000)    return { key: 'soon', tone: 'warning' }
  return { key: 'ok', tone: 'positive' }
}

/** Split an "e.g. a · b · c" hint into clickable example chips. */
function exampleChips(s: string): string[] {
  return s.replace(/^(e\.g\.\s*|例如[:：]\s*)/i, '').split('·').map(x => x.trim()).filter(Boolean)
}
function cap(s: string): string { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s }
/** Append a chip phrase to a field instead of replacing it — editing should
 *  add information, never lose it. */
function appendChip(existing: string, phrase: string): string {
  if (!existing.trim()) return cap(phrase)
  return existing.replace(/\s*$/, '').replace(/[.,;:]\s*$/, '') + ', ' + phrase
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

function HeroMetric({ label, value, tone }: { label: string; value: string; tone?: 'pos' | 'neg' }) {
  return (
    <div className="pos-hero-metric">
      <div className="pos-hero-metric-label">{label}</div>
      <div className={`pos-hero-metric-value text-tabular${tone ? ' ' + tone : ''}`}>{value}</div>
    </div>
  )
}

// ── Conviction — position-level signal, lives in the Hero ─────
const CONV_TONE: Record<'high' | 'medium' | 'low', string> = { high: 'positive', medium: 'accent', low: 'warning' }

function HeroConviction({ value, t, onSet }: {
  value: 'high' | 'medium' | 'low' | null
  t: (k: string, v?: Record<string, string | number>) => string
  onSet: (c: 'high' | 'medium' | 'low') => void
}) {
  const [open, setOpen] = useState(false)
  if (open) {
    return (
      <span className="pos-hero-conv">
        {(['high', 'medium', 'low'] as const).map(c => (
          <button key={c} type="button"
            className={`pos-chip pos-chip--xs${value === c ? ' pos-chip--on' : ''}`}
            style={value === c ? { ['--chip' as string]: TONE_VAR[CONV_TONE[c]] } : undefined}
            onClick={() => { onSet(c); setOpen(false) }}>{t(`pos_conv_${c}`)}</button>
        ))}
      </span>
    )
  }
  if (!value) {
    return <button type="button" className="pos-badge pos-conv-badge pos-conv-unset" onClick={() => setOpen(true)} title={t('pos_conviction')}>{t('pos_convb_set')}</button>
  }
  return (
    <button type="button" className="pos-badge pos-conv-badge"
      style={{ background: `color-mix(in srgb, ${TONE_VAR[CONV_TONE[value]]} 14%, transparent)`, color: TONE_VAR[CONV_TONE[value]] }}
      onClick={() => setOpen(true)} title={t('pos_conviction')}>{t(`pos_convb_${value}`)}</button>
  )
}

// ── Investment Thesis (display → edit, guided) ────────────────

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
  function applyTemplate(type: ThesisType) {
    const tpl = thesisTemplate(type, lang)
    setD({ thesis: tpl.thesis, bullCase: tpl.bullCase, bearCase: tpl.bearCase, invalidation: tpl.invalidation })
    setEditing(true)
  }

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
          <Field label={t('pos_thesis_field')} hint={t('pos_thesis_hint')} chips={exampleChips(t('pos_ex_thesis'))} onPick={v => setD({ ...d, thesis: appendChip(d.thesis, v) })} value={d.thesis} onChange={v => setD({ ...d, thesis: v })} rows={3} />
          <Field label={t('pos_bull')} hint={t('pos_bull_hint')} chips={exampleChips(t('pos_ex_bull'))} onPick={v => setD({ ...d, bullCase: appendChip(d.bullCase, v) })} tone="positive" value={d.bullCase} onChange={v => setD({ ...d, bullCase: v })} rows={2} />
          <Field label={t('pos_bear')} hint={t('pos_bear_hint')} chips={exampleChips(t('pos_ex_bear'))} onPick={v => setD({ ...d, bearCase: appendChip(d.bearCase, v) })} tone="negative" value={d.bearCase} onChange={v => setD({ ...d, bearCase: v })} rows={2} />
          <Field label={t('pos_invalidation')} hint={t('pos_invalidation_hint')} chips={exampleChips(t('pos_ex_invalidation'))} onPick={v => setD({ ...d, invalidation: appendChip(d.invalidation, v) })} tone="warning" value={d.invalidation} onChange={v => setD({ ...d, invalidation: v })} rows={2} />
          <div className="pos-save-row">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}><X size={13} />{t('pos_cancel')}</button>
            <button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={saving}><Check size={13} />{t('pos_save')}</button>
          </div>
        </>
      ) : empty ? (
        <div className="pos-framework">
          <div className="pos-fw-title">{t('pos_thesis_empty_title')}</div>
          <div className="pos-tpl">
            <span className="pos-tpl-label">{t('pos_start_template')}</span>
            {THESIS_TYPES.map(tt => (
              <button key={tt} type="button" className="pos-chip" onClick={() => applyTemplate(tt)}>{thesisTemplate(tt, lang).label}</button>
            ))}
          </div>
          <FwPrompt n="1"                q={t('pos_thesis_hint')}       ex={t('pos_ex_thesis')} />
          <FwPrompt n="2" tone="positive" q={t('pos_bull_hint')}         ex={t('pos_ex_bull')} />
          <FwPrompt n="3" tone="negative" q={t('pos_bear_hint')}         ex={t('pos_ex_bear')} />
          <FwPrompt n="4" tone="warning"  q={t('pos_invalidation_hint')} ex={t('pos_ex_invalidation')} />
          <button type="button" className="btn btn-ghost btn-sm pos-fw-cta" onClick={startEdit}><Plus size={13} />{t('pos_scratch')}</button>
        </div>
      ) : (
        <div className="pos-memo">
          <MemoSection tone="accent" label={t('pos_why')} value={intel.thesis} lead />
          <MemoSection icon={<TrendingUp size={12} />}    tone="positive" label={t('pos_bull')}         value={intel.bullCase} />
          <MemoSection icon={<TrendingDown size={12} />}  tone="negative" label={t('pos_bear')}         value={intel.bearCase} />
          <MemoSection icon={<AlertTriangle size={12} />} tone="warning"  label={t('pos_invalidation')} value={intel.invalidation} />
        </div>
      )}
    </div>
  )
}

function FwPrompt({ n, icon, tone, q, ex }: { n?: string; icon?: ReactNode; tone?: string; q: string; ex: string }) {
  return (
    <div className="pos-fw-item">
      <span className="pos-fw-num" style={tone ? { ['--chip' as string]: TONE_VAR[tone] } : undefined}>{icon ?? n}</span>
      <div><div className="pos-fw-q">{q}</div><div className="pos-fw-ex">{ex}</div></div>
    </div>
  )
}

function MemoSection({ icon, tone, label, value, lead }: { icon?: ReactNode; tone: string; label: string; value: string; lead?: boolean }) {
  if (!value) return null
  return (
    <div className="pos-memo-section">
      <div className="pos-memo-label" style={{ color: TONE_VAR[tone] }}>{icon}{label}</div>
      <p className={lead ? 'pos-memo-lead' : 'pos-memo-body'}>{value}</p>
    </div>
  )
}

// ── Target Planner (display → edit) ───────────────────────────
function TargetCard({ intel, currency, currentPrice, t, lang, onSave }: {
  intel: PI.PositionIntel
  currency: string
  currentPrice: number
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
            <NumField label={t('pos_target_price')} sym={sym} value={d.targetPrice} onChange={v => setD({ ...d, targetPrice: v })} presets={[25, 50, 100]} base={currentPrice} />
            <NumField label={t('pos_fair_value')}   sym={sym} value={d.fairValue}   onChange={v => setD({ ...d, fairValue: v })} />
            <NumField label={t('pos_trim_above')} tone="warning"  sym={sym} value={d.trimAbove} onChange={v => setD({ ...d, trimAbove: v })} presets={[20, 30, 50]} base={currentPrice} />
            <NumField label={t('pos_add_below')}  tone="positive" sym={sym} value={d.addBelow}  onChange={v => setD({ ...d, addBelow: v })} presets={[-10, -20, -30]} base={currentPrice} />
          </div>
          <Field label={t('pos_notes')} value={d.planNotes} onChange={v => setD({ ...d, planNotes: v })} rows={2} />
          <div className="pos-save-row">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}><X size={13} />{t('pos_cancel')}</button>
            <button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={saving}><Check size={13} />{t('pos_save')}</button>
          </div>
        </>
      ) : empty ? (
        <div className="pos-framework">
          <div className="pos-fw-title">{t('pos_planner_empty_title')}</div>
          <div className="pos-fw-intro">{t('pos_planner_intro')}</div>
          <FwPrompt icon={<Target size={13} />}    tone="accent"   q={t('pos_target_price')} ex={t('pos_fw_target')} />
          <FwPrompt icon={<ArrowUp size={13} />}   tone="warning"  q={t('pos_trim_above')}   ex={t('pos_fw_trim')} />
          <FwPrompt icon={<ArrowDown size={13} />} tone="positive" q={t('pos_add_below')}    ex={t('pos_fw_add')} />
          <button type="button" className="btn btn-primary btn-sm pos-fw-cta" onClick={startEdit}><Plus size={13} />{t('pos_planner_add')}</button>
        </div>
      ) : (
        <>
          <TargetLadder intel={intel} currentPrice={currentPrice} sym={sym} t={t} />
          {intel.planNotes && <div className="pos-tgt-notes">{intel.planNotes}</div>}
        </>
      )}
    </div>
  )
}

function TargetLadder({ intel, currentPrice, sym, t }: {
  intel: PI.PositionIntel; currentPrice: number; sym: string
  t: (k: string, v?: Record<string, string | number>) => string
}) {
  type Rung = { key: string; label: string; value: number; tone: string; icon: ReactNode; primary?: boolean; isNow?: boolean }
  const rungs: Rung[] = []
  if (intel.trimAbove   != null) rungs.push({ key: 'trim',   label: t('pos_trim_above'),   value: intel.trimAbove,   tone: 'warning',  icon: <ArrowUp size={14} /> })
  if (intel.targetPrice != null) rungs.push({ key: 'target', label: t('pos_target_price'), value: intel.targetPrice, tone: 'accent',   icon: <Target size={14} />, primary: true })
  if (intel.fairValue   != null) rungs.push({ key: 'fair',   label: t('pos_fair_value'),   value: intel.fairValue,   tone: 'accent2',  icon: <Scale size={14} /> })
  if (intel.addBelow    != null) rungs.push({ key: 'add',    label: t('pos_add_below'),    value: intel.addBelow,    tone: 'positive', icon: <ArrowDown size={14} /> })
  rungs.push({ key: 'now', label: t('pos_now'), value: currentPrice, tone: 'neutral', icon: <Minus size={14} />, isNow: true })
  rungs.sort((a, b) => b.value - a.value)
  return (
    <div className="pos-ladder">
      {rungs.map(r => {
        const dist = currentPrice ? ((r.value - currentPrice) / currentPrice) * 100 : 0
        return (
          <div key={r.key} className={`pos-rung${r.isNow ? ' pos-rung--now' : ''}${r.primary ? ' pos-rung--primary' : ''}`} style={{ ['--lvl' as string]: TONE_VAR[r.tone] }}>
            <span className="pos-rung-icon">{r.icon}</span>
            <span className="pos-rung-label">{r.label}</span>
            <span className="pos-rung-val text-tabular">{sym}{r.value.toFixed(2)}</span>
            {r.isNow
              ? <span className="pos-rung-dist" />
              : <span className="pos-rung-dist text-tabular">{dist >= 0 ? '+' : ''}{dist.toFixed(1)}%</span>}
          </div>
        )
      })}
    </div>
  )
}


// ── Decision Log ──────────────────────────────────────────────
const REVIEW_OPTS: (number | null)[] = [null, 30, 60, 90, 180]

function DecisionLog({ log, t, lang, openedLabel, freq, nextReviewAt, onReview, onAdd, onDelete }: {
  log: PI.DecisionEntry[]
  t: (k: string, v?: Record<string, string | number>) => string
  lang: 'en' | 'zh'
  openedLabel: string
  freq: number | null
  nextReviewAt: string | null
  onReview: (days: number | null) => void
  onAdd: (body: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [draft, setDraft] = useState('')
  const [busy, setBusy]   = useState(false)

  async function add() {
    if (!draft.trim()) return
    setBusy(true); await onAdd(draft); setBusy(false); setDraft('')
  }

  const KIND: Record<string, { tone: string; tkey: string; Icon: LucideIcon }> = {
    opened:         { tone: 'accent',   tkey: 'pos_logt_opened',  Icon: Flag },
    added:          { tone: 'positive', tkey: 'pos_logt_added',   Icon: Plus },
    reduced:        { tone: 'warning',  tkey: 'pos_logt_reduced', Icon: Minus },
    exited:         { tone: 'negative', tkey: 'pos_logt_exited',  Icon: LogOut },
    thesis_updated: { tone: 'accent',   tkey: 'pos_logt_thesis',  Icon: FileText },
    target_updated: { tone: 'warning',  tkey: 'pos_logt_target',  Icon: Target },
    manual:         { tone: 'neutral',  tkey: 'pos_logt_review',  Icon: MessageSquare },
    review:         { tone: 'neutral',  tkey: 'pos_logt_review',  Icon: MessageSquare },
  }

  return (
    <div className="panel">
      <div className="pos-section-label">{t('pos_decision_log')}</div>

      {/* review cadence — foundation for the future Alert Engine */}
      <div className="pos-review">
        <span className="pos-review-label">{t('pos_review_every')}</span>
        {REVIEW_OPTS.map(dd => (
          <button key={dd ?? 'off'} type="button"
            className={`pos-chip${freq === dd ? ' pos-chip--on' : ''}`}
            onClick={() => onReview(dd)}>{dd === null ? t('pos_review_off') : t('pos_review_days', { n: dd })}</button>
        ))}
        {nextReviewAt && <span className="pos-review-next">{t('pos_review_next', { date: dateShort(nextReviewAt, lang) })}</span>}
      </div>

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
            const KindIcon = meta.Icon
            const body = e.synthetic ? (e.kind === 'opened' ? openedLabel : '') : e.body
            return (
              <div key={e.id} className="pos-tl-item">
                <span className="pos-tl-dot" style={{ background: TONE_VAR[meta.tone] }} />
                <div className="pos-tl-head">
                  <span className="pos-tl-type" style={{ color: TONE_VAR[meta.tone] }}><KindIcon size={12} />{t(meta.tkey)}</span>
                  {!e.synthetic && <button type="button" className="pos-tl-del" onClick={() => onDelete(e.id)} aria-label="Delete"><Trash2 size={12} /></button>}
                </div>
                {body && <div className="pos-tl-detail">{body}</div>}
                <div className="pos-tl-date">{dateShort(e.at, lang)}</div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Field primitives ──────────────────────────────────────────
function Field({ label, hint, tone, value, onChange, rows = 2, chips, onPick }: {
  label: string; hint?: string; tone?: string; value: string; onChange: (v: string) => void
  rows?: number; chips?: string[]; onPick?: (v: string) => void
}) {
  return (
    <div className="pos-field-group">
      <div className="pos-field-head" style={tone ? { color: TONE_VAR[tone] } : undefined}>{label}{hint && <span className="pos-field-hint">{hint}</span>}</div>
      <textarea className="pos-field" rows={rows} value={value} onChange={e => onChange(e.target.value)} />
      {chips && chips.length > 0 && (
        <div className="pos-ex-chips">
          {chips.map(c => <button key={c} type="button" className="pos-chip pos-chip--xs" onClick={() => onPick?.(c)}>{c}</button>)}
        </div>
      )}
    </div>
  )
}

function NumField({ label, tone, sym, value, onChange, presets, base }: {
  label: string; tone?: string; sym: string; value: string; onChange: (v: string) => void; presets?: number[]; base?: number
}) {
  return (
    <div>
      <div className="pos-tgt-label" style={tone ? { color: TONE_VAR[tone] } : undefined}>{label}</div>
      <div className="pos-num-input">
        <span className="pos-num-sym">{sym}</span>
        <input className="pos-field" inputMode="decimal" value={value} onChange={e => onChange(e.target.value)} />
      </div>
      {presets && base ? (
        <div className="pos-presets">
          {presets.map(p => {
            const px = base * (1 + p / 100)
            return (
              <button key={p} type="button" className="pos-chip pos-chip--xs"
                onClick={() => onChange(px.toFixed(2))}>{p > 0 ? '+' : ''}{p}% · {sym}{px >= 100 ? Math.round(px) : px.toFixed(2)}</button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

// number <-> string helpers for inputs
function s(v: number | null): string { return v == null ? '' : String(v) }
function n(v: string): number | null { const x = parseFloat(v); return Number.isFinite(x) ? x : null }
