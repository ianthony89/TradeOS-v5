'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { BookOpen, ChevronDown, Check, ArrowUpRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useI18n } from '@/lib/i18n/context'
import { fmt } from '@/lib/utils/format'
import { Panel, PanelHead, PanelBody } from '@/components/ui/panel'
import { EmptyState } from '@/components/ui/empty-state'
import { DeltaBadge } from '@/components/ui/delta-badge'
import { SymCell } from '@/components/brand/stock-logo'
import { stockName } from '@/lib/portfolio/stock-names'
import { reviewStatus, type ReviewStatus } from '@/lib/portfolio/review-status'
import { positionQuality, type QualityGrade } from '@/lib/portfolio/position-quality'
import * as PI from '@/lib/portfolio/position-intel'

const CADENCES = [30, 60, 90, 180]

const TONE_VAR: Record<string, string> = {
  accent: 'var(--accent)', positive: 'var(--positive)', negative: 'var(--negative)', warning: 'var(--warning)',
}
interface Pos {
  symbol: string; symbolNormalized: string; name: string; currency: string
  currentPrice: number; avgCost: number; unrealizedPl: number; unrealizedPlPct: number
}
/* eslint-disable @typescript-eslint/no-explicit-any */
function mapHolding(r: any): Pos {
  return {
    symbol: r.symbol, symbolNormalized: r.symbol_normalized, name: r.name ?? r.symbol, currency: r.currency,
    currentPrice: Number(r.current_price ?? r.avg_cost), avgCost: Number(r.avg_cost),
    unrealizedPl: Number(r.unrealized_pl ?? 0), unrealizedPlPct: Number(r.unrealized_pl_pct ?? 0),
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

function fmtDate(iso: string, lang: 'en' | 'zh'): string {
  return new Date(iso).toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric' })
}

export default function JournalPage() {
  const { t, lang } = useI18n()
  const sb = createClient()

  const [userId, setUserId]   = useState<string | null>(null)
  const [holdings, setHoldings] = useState<Pos[]>([])
  const [intelMap, setIntelMap] = useState<Map<string, PI.PositionIntel>>(new Map())
  const [decisions, setDecisions] = useState<PI.DecisionEntryWithSymbol[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    ;(async () => {
      const { data: { user } } = await sb.auth.getUser()
      if (!user || !alive) return
      setUserId(user.id)
      const { data: rows } = await sb.from('holdings').select('*').eq('user_id', user.id).order('market_value', { ascending: false })
      const [im, dec] = await Promise.all([
        PI.loadAllPositionIntel(sb, user.id),
        PI.loadRecentDecisions(sb, user.id, 200),
      ])
      if (!alive) return
      setHoldings((rows ?? []).map(mapHolding))
      setIntelMap(im)
      setDecisions(dec)
      setLoading(false)
    })()
    return () => { alive = false }
  }, [sb])

  /* last-reviewed (real note date if any, else the schedule date) + has-log */
  const { lastReviewedMap, hasLogSet } = useMemo(() => {
    const lr = new Map<string, string>()
    const has = new Set<string>()
    for (const d of decisions) {
      has.add(d.symbol)
      if (!lr.has(d.symbol)) lr.set(d.symbol, d.at)   // decisions are newest-first
    }
    return { lastReviewedMap: lr, hasLogSet: has }
  }, [decisions])

  const enriched = useMemo(() => holdings.map(pos => {
    const intel  = intelMap.get(pos.symbolNormalized)
    const grade  = positionQuality(intel, hasLogSet.has(pos.symbolNormalized)).grade
    const status = intel?.reviewFrequencyDays != null ? reviewStatus(intel?.nextReviewAt ?? null) : null
    const fromLog = lastReviewedMap.get(pos.symbolNormalized)
    const lastReviewed = fromLog
      ? fmtDate(fromLog, lang)
      : (intel?.nextReviewAt && intel.reviewFrequencyDays)
        ? fmtDate(new Date(new Date(intel.nextReviewAt).getTime() - intel.reviewFrequencyDays * 86_400_000).toISOString(), lang)
        : t('jr_never')
    return { pos, intel, grade, status, lastReviewed }
  }), [holdings, intelMap, hasLogSet, lastReviewedMap, lang, t])

  const overdue   = enriched.filter(e => e.status?.state === 'overdue')
  const dueToday  = enriched.filter(e => e.status?.state === 'due')
  const soon      = enriched.filter(e => e.status?.state === 'soon')
  const onSched   = enriched.filter(e => e.status?.state === 'ok').length
  const untracked = enriched.filter(e => !e.intel?.reviewFrequencyDays)
  const queueCount = overdue.length + dueToday.length + soon.length

  const holdingMeta = useMemo(() => {
    const sym = new Map<string, string>()
    const ret = new Map<string, number>()
    for (const h of holdings) { sym.set(h.symbolNormalized, h.symbol); ret.set(h.symbolNormalized, h.unrealizedPlPct) }
    return { sym, ret }
  }, [holdings])
  const history = decisions.filter(d => d.body.trim()).slice(0, 50)

  async function saveReview(pos: Pos, cadence: number, note: string) {
    if (!userId) return
    const nextReviewAt = PI.computeNextReview(cadence)
    await PI.saveMeta(sb, userId, pos.symbol, pos.symbolNormalized, { reviewFrequencyDays: cadence, nextReviewAt })
    const trimmed = note.trim()
    if (trimmed) await PI.addReview(sb, userId, pos.symbolNormalized, trimmed)
    setIntelMap(prev => {
      const next = new Map(prev)
      const cur = next.get(pos.symbolNormalized) ?? PI.EMPTY_INTEL
      next.set(pos.symbolNormalized, { ...cur, reviewFrequencyDays: cadence, nextReviewAt })
      return next
    })
    if (trimmed) {
      setDecisions(prev => [{ id: `tmp-${Date.now()}`, symbol: pos.symbolNormalized, kind: 'manual', body: trimmed, at: new Date().toISOString() }, ...prev])
    }
  }

  if (loading) {
    return <div><div className="section-header"><div><h1 className="section-title">{t('nav_journal')}</h1></div></div><div className="text-tertiary" style={{ fontSize: 13 }}>{t('pos_loading')}</div></div>
  }
  if (!holdings.length) {
    return (
      <div>
        <div className="section-header"><div><h1 className="section-title">{t('nav_journal')}</h1><p className="section-sub">{t('jr_sub')}</p></div></div>
        <Panel><PanelBody>
          <EmptyState icon={<BookOpen size={20} />} title={t('soon_journal_title')} sub={t('soon_journal_desc')}
            actions={<Link href="/holdings" className="btn btn-primary btn-sm">{t('holdings_import')}</Link>} />
        </PanelBody></Panel>
      </div>
    )
  }

  return (
    <div className="jr-page">
      <div className="section-header"><div><h1 className="section-title">{t('nav_journal')}</h1><p className="section-sub">{t('jr_sub')}</p></div></div>

      {/* 1 · Review Pulse */}
      <div className="jr-pulse">
        <PulseCell n={overdue.length}   label={t('jr_pulse_overdue')}   tone="negative" />
        <PulseCell n={dueToday.length + soon.length} label={t('jr_pulse_due')} tone="warning" />
        <PulseCell n={onSched}          label={t('jr_pulse_ok')}        tone="positive" />
        <PulseCell n={untracked.length} label={t('jr_pulse_untracked')} tone="neutral" />
      </div>

      {/* 2 · Review Queue */}
      <Panel>
        <PanelHead title={t('nav_journal')} meta={t('jr_sub')} />
        <PanelBody>
          {queueCount === 0 ? (
            <div className="jr-empty">{t('jr_queue_empty')}</div>
          ) : (
            <>
              <QueueGroup label={t('jr_grp_overdue')} items={overdue}  t={t} lang={lang} onSave={saveReview} />
              <QueueGroup label={t('jr_grp_due')}     items={dueToday} t={t} lang={lang} onSave={saveReview} />
              <QueueGroup label={t('jr_grp_soon')}    items={soon}     t={t} lang={lang} onSave={saveReview} />
            </>
          )}
        </PanelBody>
      </Panel>

      {/* Untracked — set an initial cadence right here */}
      {untracked.length > 0 && (
        <Panel>
          <PanelHead title={t('jr_untracked_title')} meta={t('jr_untracked_sub')} />
          <PanelBody>
            <div className="jr-untracked">
              {untracked.map(e => (
                <UntrackedRow key={e.pos.symbolNormalized} pos={e.pos} grade={e.grade} t={t} lang={lang} onStart={saveReview} />
              ))}
            </div>
          </PanelBody>
        </Panel>
      )}

      {/* 3 · Review History */}
      <Panel>
        <PanelHead title={t('jr_history_title')} meta={t('jr_history_sub')} />
        <PanelBody>
          {history.length === 0 ? (
            <div className="jr-empty">{t('jr_history_empty')}</div>
          ) : (
            <div className="jr-hist">
              {history.map(d => {
                const ret = holdingMeta.ret.get(d.symbol)
                return (
                  <Link key={d.id} href={`/holdings/${encodeURIComponent(d.symbol)}`} className="jr-hist-item">
                    <span className="jr-hist-sym">{holdingMeta.sym.get(d.symbol) ?? d.symbol}</span>
                    <span className="jr-hist-body">{d.body}</span>
                    <span className="jr-hist-meta">
                      {ret != null && <DeltaBadge value={ret} variant="pill" />}
                      <span className="jr-hist-date">{fmtDate(d.at, lang)}</span>
                    </span>
                  </Link>
                )
              })}
            </div>
          )}
        </PanelBody>
      </Panel>
    </div>
  )
}

// ── pieces ────────────────────────────────────────────────────
function PulseCell({ n, label, tone }: { n: number; label: string; tone: 'negative' | 'warning' | 'positive' | 'neutral' }) {
  return (
    <div className="jr-pulse-cell">
      <span className="jr-pulse-n" style={{ color: tone === 'neutral' ? 'var(--text-secondary)' : TONE_VAR[tone] }}>{n}</span>
      <span className="jr-pulse-label">{label}</span>
    </div>
  )
}

type Enriched = { pos: Pos; intel?: PI.PositionIntel; grade: QualityGrade; status: ReviewStatus | null; lastReviewed: string }

function QueueGroup({ label, items, t, lang, onSave }: {
  label: string; items: Enriched[]
  t: (k: string, v?: Record<string, string | number>) => string; lang: 'en' | 'zh'
  onSave: (pos: Pos, cadence: number, note: string) => Promise<void>
}) {
  if (!items.length) return null
  return (
    <div className="jr-group">
      <div className="jr-group-head">{label}<span className="jr-group-n">{items.length}</span></div>
      {items.map(e => <ReviewRow key={e.pos.symbolNormalized} e={e} t={t} lang={lang} onSave={onSave} />)}
    </div>
  )
}

function ReviewRow({ e, t, lang, onSave }: {
  e: Enriched
  t: (k: string, v?: Record<string, string | number>) => string; lang: 'en' | 'zh'
  onSave: (pos: Pos, cadence: number, note: string) => Promise<void>
}) {
  const { pos, intel, grade, status, lastReviewed } = e
  const [open, setOpen]     = useState(false)
  const [cad, setCad]       = useState<number | null>(null)
  const [note, setNote]     = useState('')
  const [saving, setSaving] = useState(false)

  const statusLabel = !status ? '' :
    status.state === 'overdue' ? t('attn_rq_overdue_n', { n: Math.abs(status.days) }) :
    status.state === 'due'     ? t('attn_rq_due_today') :
                                 t('attn_rq_soon_n', { n: status.days })

  async function save() {
    if (cad == null) return
    setSaving(true); await onSave(pos, cad, note); setSaving(false)
    setOpen(false); setCad(null); setNote('')
  }

  return (
    <div className={`jr-row${open ? ' jr-row--open' : ''}`}>
      <button type="button" className="jr-row-head" onClick={() => setOpen(o => !o)}>
        <SymCell symbol={pos.symbol} name={stockName(pos.symbol, pos.name, lang)} currency={pos.currency} logoSize={24} />
        <span className="jr-row-meta">
          <span className={`jr-status jr-status--${status?.tone ?? 'positive'}`}>{statusLabel}</span>
          <span className="jr-grade">{grade}</span>
          <ChevronDown size={15} className="jr-chev" />
        </span>
      </button>

      {open && (
        <div className="jr-detail">
          <div className="jr-memo">
            <Memo label={t('pos_why')}          tone="accent"   value={intel?.thesis} />
            <Memo label={t('pos_bull')}         tone="positive" value={intel?.bullCase} />
            <Memo label={t('pos_bear')}         tone="negative" value={intel?.bearCase} />
            <Memo label={t('pos_invalidation')} tone="warning"  value={intel?.invalidation} />
            {!intel?.thesis && !intel?.bullCase && !intel?.bearCase && !intel?.invalidation && (
              <div className="jr-memo-none">{t('jr_never')}</div>
            )}
          </div>

          <TargetLevels intel={intel} current={pos.currentPrice} cur={pos.currency} t={t} />

          <div className="jr-last">{t('jr_last_reviewed')}: <span>{lastReviewed}</span></div>

          <div className="jr-form">
            <div className="jr-form-label">{t('jr_next_review')} <span className="jr-req">{t('jr_next_required')}</span></div>
            <div className="jr-cads">
              {CADENCES.map(d => (
                <button key={d} type="button" className={`pos-chip${cad === d ? ' pos-chip--on' : ''}`} onClick={() => setCad(d)}>
                  {t('pos_review_days', { n: d })}
                </button>
              ))}
            </div>
            <textarea className="jr-note" rows={2} placeholder={t('jr_note_ph')} value={note} onChange={ev => setNote(ev.target.value)} />
            <div className="jr-actions">
              <button type="button" className="btn btn-ghost btn-sm" disabled={cad == null || saving}
                onClick={save} title={cad == null ? t('jr_pick_cadence') : undefined}>
                <Check size={13} />{t('jr_save')}
              </button>
              <Link href={`/holdings/${encodeURIComponent(pos.symbolNormalized)}`} className="btn btn-primary btn-sm">
                {t('jr_open_hub')}<ArrowUpRight size={13} />
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Memo({ label, tone, value }: { label: string; tone: string; value?: string }) {
  if (!value) return null
  return (
    <div className="jr-memo-item">
      <span className="jr-memo-label" style={{ color: TONE_VAR[tone] }}>{label}</span>
      <p className="jr-memo-body">{value}</p>
    </div>
  )
}

function TargetLevels({ intel, current, cur, t }: {
  intel?: PI.PositionIntel; current: number; cur: string
  t: (k: string, v?: Record<string, string | number>) => string
}) {
  if (!intel) return null
  const rows: { label: string; v: number }[] = []
  if (intel.targetPrice != null) rows.push({ label: t('pos_target_price'), v: intel.targetPrice })
  if (intel.fairValue   != null) rows.push({ label: t('pos_fair_value'),   v: intel.fairValue })
  if (intel.trimAbove   != null) rows.push({ label: t('pos_trim_above'),   v: intel.trimAbove })
  if (intel.addBelow    != null) rows.push({ label: t('pos_add_below'),    v: intel.addBelow })
  if (!rows.length) return null
  return (
    <div className="jr-targets">
      <div className="jr-targets-label">{t('jr_targets')}</div>
      {rows.map(r => {
        const dist = current > 0 ? ((r.v - current) / current) * 100 : 0
        return (
          <div key={r.label} className="jr-target-row">
            <span>{r.label}</span>
            <span className="jr-target-v">{fmt.money(r.v, cur)} <span className="jr-target-dist">{dist >= 0 ? '+' : ''}{fmt.pct(dist, 1)}</span></span>
          </div>
        )
      })}
    </div>
  )
}

function UntrackedRow({ pos, grade, t, lang, onStart }: {
  pos: Pos; grade: QualityGrade
  t: (k: string, v?: Record<string, string | number>) => string; lang: 'en' | 'zh'
  onStart: (pos: Pos, cadence: number, note: string) => Promise<void>
}) {
  const [cad, setCad]       = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  async function start() { if (cad == null) return; setSaving(true); await onStart(pos, cad, ''); setSaving(false) }
  return (
    <div className="jr-untracked-row">
      <SymCell symbol={pos.symbol} name={stockName(pos.symbol, pos.name, lang)} currency={pos.currency} logoSize={24} />
      <span className="jr-grade">{grade}</span>
      <div className="jr-cads">
        {CADENCES.map(d => (
          <button key={d} type="button" className={`pos-chip${cad === d ? ' pos-chip--on' : ''}`} onClick={() => setCad(d)}>
            {t('pos_review_days', { n: d })}
          </button>
        ))}
      </div>
      <button type="button" className="btn btn-primary btn-sm" disabled={cad == null || saving} onClick={start}>{t('jr_start')}</button>
    </div>
  )
}
