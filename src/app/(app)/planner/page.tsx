'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Wallet, Scissors, Target as TargetIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useI18n } from '@/lib/i18n/context'
import { useMarketStore, selectActiveFxRate } from '@/stores/market'
import { useHoldingsStore } from '@/stores/holdings'
import { applyLiveQuote } from '@/lib/portfolio/live-price'
import { fmt } from '@/lib/utils/format'
import { Panel, PanelHead, PanelBody } from '@/components/ui/panel'
import { EmptyState } from '@/components/ui/empty-state'
import { SymCell } from '@/components/brand/stock-logo'
import { stockName } from '@/lib/portfolio/stock-names'
import { classifyStrategy, ACTION_TONE } from '@/lib/portfolio/taxonomy'
import {
  STRATEGIES, deployProportional, deployStrategyTarget, reduceToWeight, strategyGap,
  type PlannerPosition, type StrategyTarget, type DeployResult,
} from '@/lib/portfolio/planner'

const TONE_VAR: Record<string, string> = {
  neutral: 'var(--text-tertiary)', positive: 'var(--positive)', warning: 'var(--warning)', negative: 'var(--negative)', accent: 'var(--accent)',
}
const STRAT_TONE: Record<string, string> = { CORE: 'positive', TACTICAL: 'accent', SPECULATIVE: 'warning' }
const ACTION_KEY: Record<'ADD' | 'REDUCE' | 'HOLD', string> = { ADD: 'pl_buy', REDUCE: 'pl_trim', HOLD: 'pl_hold' }

interface Pos {
  symbol: string; symbolNormalized: string; name: string; currency: string
  marketValue: number; currentPrice: number; assetType: string; quantity: number; avgCost: number
}
/* eslint-disable @typescript-eslint/no-explicit-any */
function mapHolding(r: any): Pos {
  return {
    symbol: r.symbol, symbolNormalized: r.symbol_normalized, name: r.name ?? r.symbol, currency: r.currency,
    marketValue: Number(r.market_value ?? 0), currentPrice: Number(r.current_price ?? r.avg_cost), assetType: r.asset_type ?? 'US_EQUITY',
    quantity: Number(r.quantity ?? 0), avgCost: Number(r.avg_cost ?? 0),
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const num = (s: string): number => { const n = parseFloat(s); return Number.isFinite(n) ? n : 0 }
function shares(n: number): string { return n >= 100 ? Math.round(n).toLocaleString() : n.toFixed(2) }

export default function PlannerPage() {
  const { t, lang } = useI18n()
  const sb = createClient()
  const fxRate             = useMarketStore(selectActiveFxRate)
  const primaryCurrency    = useMarketStore(s => s.primaryCurrency)
  const setPrimaryCurrency = useMarketStore(s => s.setPrimaryCurrency)

  const quotes             = useHoldingsStore(s => s.quotes)
  const fx = fxRate > 0 ? fxRate : 4   // guard: never divide by a zero/blank FX

  const [rows, setRows] = useState<Pos[]>([])
  const [loading, setLoading] = useState(true)
  const [strategyTarget, setStrategyTarget] = useState<StrategyTarget>({ CORE: 50, TACTICAL: 30, SPECULATIVE: 20 })

  useEffect(() => {
    let alive = true
    ;(async () => {
      const { data: { user } } = await sb.auth.getUser()
      if (!user || !alive) return
      const { data } = await sb.from('holdings').select('*').eq('user_id', user.id).order('market_value', { ascending: false })
      if (!alive) return
      setRows((data ?? []).map(mapHolding))
      setLoading(false)
    })()
    return () => { alive = false }
  }, [sb])

  const toDisplay = (u: number) => (primaryCurrency === 'USD' ? u : u * fx)
  const fromDisplay = (d: number) => (primaryCurrency === 'USD' ? d : d / fx)
  const money = (u: number) => fmt.money(toDisplay(u), primaryCurrency)

  const { positions, totalUsd } = useMemo(() => {
    // overlay session live quotes so the Planner matches the Dashboard (not the DB snapshot)
    const live = rows.map(p => {
      const lq = applyLiveQuote(
        { currentPrice: p.currentPrice, marketValue: p.marketValue, unrealizedPl: 0, unrealizedPlPct: 0, todayPl: 0, avgCost: p.avgCost, quantity: p.quantity },
        quotes.get(p.symbolNormalized),
      )
      return { ...p, marketValue: lq.marketValue, currentPrice: lq.currentPrice }
    })
    const total = live.reduce((s, p) => s + (p.currency === 'MYR' ? p.marketValue / fx : p.marketValue), 0)
    const list: PlannerPosition[] = live.map(p => {
      const usdValue = p.currency === 'MYR' ? p.marketValue / fx : p.marketValue
      return {
        symbol: p.symbol, symbolNormalized: p.symbolNormalized, name: p.name, currency: p.currency,
        usdValue, priceUsd: p.currency === 'MYR' ? p.currentPrice / fx : p.currentPrice,
        weight: total > 0 ? (usdValue / total) * 100 : 0,
        strategy: classifyStrategy({ symbol: p.symbol, name: p.name, assetType: p.assetType, unrealizedPlPct: 0, portfolioWeight: 0 }),
      }
    })
    return { positions: list, totalUsd: total }
  }, [rows, quotes, fx])

  if (loading) {
    return <div><div className="section-header"><div><h1 className="section-title">{t('nav_planner')}</h1></div></div><div className="text-tertiary" style={{ fontSize: 13 }}>{t('pos_loading')}</div></div>
  }
  if (!rows.length) {
    return (
      <div>
        <div className="section-header"><div><h1 className="section-title">{t('nav_planner')}</h1><p className="section-sub">{t('pl_sub')}</p></div></div>
        <Panel><PanelBody>
          <EmptyState icon={<Wallet size={20} />} title={t('empty_title')} sub={t('empty_desc')}
            actions={<Link href="/holdings" className="btn btn-primary btn-sm">{t('holdings_import')}</Link>} />
        </PanelBody></Panel>
      </div>
    )
  }

  return (
    <div className="pl-page">
      <div className="section-header">
        <div><h1 className="section-title">{t('nav_planner')}</h1><p className="section-sub">{t('pl_sub')}</p></div>
        <div className="chip-group" role="group">
          <button type="button" onClick={() => setPrimaryCurrency('USD')} className={`chip${primaryCurrency === 'USD' ? ' chip--active' : ''}`}>USD</button>
          <button type="button" onClick={() => setPrimaryCurrency('MYR')} className={`chip${primaryCurrency === 'MYR' ? ' chip--active' : ''}`}>MYR</button>
        </div>
      </div>

      <AddCapitalCard positions={positions} strategyTarget={strategyTarget} money={money} fromDisplay={fromDisplay} t={t} lang={lang} />
      <ReduceCard positions={positions} totalUsd={totalUsd} money={money} t={t} />
      <TargetCard positions={positions} target={strategyTarget} setTarget={setStrategyTarget} money={money} t={t} />
    </div>
  )
}

// ── Card 1 · Add Capital ──────────────────────────────────────
function AddCapitalCard({ positions, strategyTarget, money, fromDisplay, t, lang }: {
  positions: PlannerPosition[]; strategyTarget: StrategyTarget
  money: (u: number) => string; fromDisplay: (d: number) => number
  t: (k: string, v?: Record<string, string | number>) => string; lang: 'en' | 'zh'
}) {
  const [cash, setCash] = useState('')
  const [mode, setMode] = useState<'current' | 'strategy'>('current')
  const cashUsd = fromDisplay(num(cash))
  const targetBalanced = Math.round(STRATEGIES.reduce((s, k) => s + (strategyTarget[k] || 0), 0)) === 100
  const result: DeployResult = useMemo(
    () => (mode === 'current' ? deployProportional(positions, cashUsd) : deployStrategyTarget(positions, cashUsd, strategyTarget)),
    [positions, cashUsd, mode, strategyTarget],
  )

  return (
    <Panel>
      <PanelHead title={<span className="pl-head"><Wallet size={14} />{t('pl_add_title')}</span>} meta={t('pl_add_sub')} />
      <PanelBody>
        <div className="pl-inputs">
          <label className="pl-field">
            <span className="pl-field-label">{t('pl_cash')}</span>
            <input type="number" min="0" className="pl-input" value={cash} onChange={e => setCash(e.target.value)} placeholder="0" />
          </label>
          <div className="pl-field">
            <span className="pl-field-label">{t('pl_allocate_by')}</span>
            <div className="pl-modes">
              {(['current', 'strategy'] as const).map(m => (
                <button key={m} type="button" className={`pl-mode${mode === m ? ' pl-mode--on' : ''}`} onClick={() => setMode(m)}>
                  <span className="pl-mode-dot" />
                  <span className="pl-mode-text">
                    <span className="pl-mode-name">{t(m === 'current' ? 'pl_mode_current' : 'pl_mode_strategy')}</span>
                    <span className="pl-mode-hint">{t(m === 'current' ? 'pl_mode_current_h' : 'pl_mode_strategy_h')}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {cashUsd <= 0 ? (
          <div className="pl-empty">{t('pl_add_empty')}</div>
        ) : mode === 'strategy' && !targetBalanced ? (
          <div className="pl-empty">{t('pl_target_fix')}</div>
        ) : (
          <>
            <div className="pl-rows">
              <div className={`pl-rh ${mode === 'strategy' ? 'pl-rh--add' : 'pl-rh--add3'}`}>
                <span>{t('pl_position')}</span><span className="num">{t('pl_col_add')}</span><span className="num">{t('pl_col_shares')}</span>
                {mode === 'strategy' && <span className="num">{t('pl_current')} → {t('pl_target')}</span>}
              </div>
              {result.suggestions.map(s => (
                <div key={s.symbolNormalized} className={`pl-row ${mode === 'strategy' ? 'pl-row--add' : 'pl-row--add3'}`}>
                  <SymCell symbol={s.symbol} name={stockName(s.symbol, s.name, lang)} currency={s.currency} logoSize={22} />
                  <span className="num pl-add">{money(s.addUsd)}</span>
                  <span className="num pl-mono">{shares(s.addShares)}</span>
                  {mode === 'strategy' && <span className="num pl-mono pl-wt">{fmt.pct(s.weightBefore, 1)} <span className="pl-arrow">→</span> {fmt.pct(s.weightAfter, 1)}</span>}
                </div>
              ))}
            </div>
            {result.undeployedUsd > 0.5 && <div className="pl-note">{t('pl_undeployed', { amount: money(result.undeployedUsd) })}</div>}
          </>
        )}
      </PanelBody>
    </Panel>
  )
}

// ── Card 2 · Reduce Concentration ─────────────────────────────
function ReduceCard({ positions, totalUsd, money, t }: {
  positions: PlannerPosition[]; totalUsd: number; money: (u: number) => string
  t: (k: string, v?: Record<string, string | number>) => string
}) {
  const sorted = useMemo(() => [...positions].sort((a, b) => b.weight - a.weight), [positions])
  const [symbol, setSymbol] = useState(sorted[0]?.symbolNormalized ?? '')
  const [target, setTarget] = useState('')
  const sel = positions.find(p => p.symbolNormalized === symbol) ?? sorted[0]
  const tgt = num(target)
  const result = sel && tgt > 0 ? reduceToWeight(sel, tgt, totalUsd) : null

  return (
    <Panel>
      <PanelHead title={<span className="pl-head"><Scissors size={14} />{t('pl_reduce_title')}</span>} meta={t('pl_reduce_sub')} />
      <PanelBody>
        <div className="pl-inputs">
          <label className="pl-field">
            <span className="pl-field-label">{t('pl_position')}</span>
            <select className="pl-input" value={symbol} onChange={e => setSymbol(e.target.value)}>
              {sorted.map(p => <option key={p.symbolNormalized} value={p.symbolNormalized}>{p.symbol} · {fmt.pct(p.weight, 1)}</option>)}
            </select>
          </label>
          <div className="pl-field pl-field--narrow">
            <span className="pl-field-label">{t('pl_current')}</span>
            <div className="pl-static">{sel ? fmt.pct(sel.weight, 1) : '—'}</div>
          </div>
          <label className="pl-field pl-field--narrow">
            <span className="pl-field-label">{t('pl_target')} %</span>
            <input type="number" min="0" max="100" className="pl-input" value={target} onChange={e => setTarget(e.target.value)} placeholder="25" />
          </label>
        </div>

        {!sel || tgt <= 0 ? (
          <div className="pl-empty">{t('pl_reduce_pick')}</div>
        ) : !result ? (
          <div className="pl-empty">{t('pl_reduce_none')}</div>
        ) : (
          <>
            <div className="pl-result">
              <div className="pl-result-cell"><span className="pl-result-label">{t('pl_reduce_sell')}</span><span className="pl-result-v">{money(result.sellUsd)}</span></div>
              <div className="pl-result-cell"><span className="pl-result-label">{t('pl_reduce_shares')}</span><span className="pl-result-v pl-mono">{shares(result.sellShares)}</span></div>
              <div className="pl-result-cell"><span className="pl-result-label">{t('pl_reduce_freed')}</span><span className="pl-result-v">{money(result.freedUsd)}</span></div>
              <div className="pl-result-cell"><span className="pl-result-label">{t('pl_reduce_newweight')}</span><span className="pl-result-v" style={{ color: 'var(--positive)' }}>{fmt.pct(sel.weight, 1)} <span className="pl-arrow">→</span> {fmt.pct(result.newWeight, 1)}</span></div>
            </div>
            <div className="pl-suggest">
              <span className="pl-suggest-label">{t('pl_suggested')}</span>
              <p className="pl-suggest-text">{t('pl_suggest_reduce', { symbol: sel.symbol, amount: money(result.sellUsd), from: fmt.pct(sel.weight, 1), to: fmt.pct(result.newWeight, 1) })}</p>
            </div>
          </>
        )}
      </PanelBody>
    </Panel>
  )
}

// ── Card 3 · Target Allocation (Strategy) ─────────────────────
function TargetCard({ positions, target, setTarget, money, t }: {
  positions: PlannerPosition[]
  target: StrategyTarget; setTarget: (t: StrategyTarget) => void
  money: (u: number) => string; t: (k: string, v?: Record<string, string | number>) => string
}) {
  const gaps = useMemo(() => strategyGap(positions, target), [positions, target])
  const sumPct = STRATEGIES.reduce((s, k) => s + (target[k] || 0), 0)
  const balanced = Math.round(sumPct) === 100

  return (
    <Panel>
      <PanelHead title={<span className="pl-head"><TargetIcon size={14} />{t('pl_target_title')}</span>} meta={t('pl_target_sub')} />
      <PanelBody>
        <div className="pl-target-edit">
          {STRATEGIES.map(s => (
            <label key={s} className="pl-target-input">
              <span className="pl-target-name" style={{ color: TONE_VAR[STRAT_TONE[s]] }}>{t(`tax_${s}`)}</span>
              <span className="pl-pct-wrap">
                <input type="number" min="0" max="100" className="pl-input pl-input--pct" value={target[s]}
                  onChange={e => setTarget({ ...target, [s]: num(e.target.value) })} />
                <span className="pl-pct-sign">%</span>
              </span>
            </label>
          ))}
          <span className={`pl-sum${balanced ? ' pl-sum--ok' : ''}`}>{balanced ? t('pl_target_sum_ok') : t('pl_target_sum', { n: Math.round(sumPct) })}</span>
        </div>

        <div className="pl-mix">
          <span className="pl-mix-label">{t('pl_current_mix')}</span>
          {gaps.map(g => (
            <span key={g.strategy} className="pl-mix-item">
              <span className="pl-mix-dot" style={{ background: TONE_VAR[STRAT_TONE[g.strategy]] }} />
              {t(`tax_${g.strategy}`)} <span className="pl-mono">{fmt.pct(g.currentPct, 0)}</span>
            </span>
          ))}
        </div>

        {!balanced ? (
          <div className="pl-empty">{t('pl_target_fix')}</div>
        ) : (
          <>
            <div className="pl-rows">
              <div className="pl-rh pl-rh--gap"><span>{t('pl_position')}</span><span className="num">{t('pl_current')}</span><span className="num">{t('pl_target')}</span><span className="num">{t('pl_col_gap')}</span><span className="num">{t('pl_col_action')}</span></div>
              {gaps.map(g => (
                <div key={g.strategy} className="pl-row pl-row--gap">
                  <span className="pl-strat" style={{ color: TONE_VAR[STRAT_TONE[g.strategy]] }}>{t(`tax_${g.strategy}`)}</span>
                  <span className="num pl-mono">{fmt.pct(g.currentPct, 1)}</span>
                  <span className="num pl-mono">{fmt.pct(g.targetPct, 1)}</span>
                  <span className="num pl-mono">{g.gapPct >= 0 ? '+' : ''}{fmt.pct(g.gapPct, 1)}</span>
                  <span className="num pl-act" style={{ color: TONE_VAR[ACTION_TONE[g.action]] }}>
                    {t(ACTION_KEY[g.action])}{g.action !== 'HOLD' && <span className="pl-act-amt"> {money(Math.abs(g.deltaUsd))}</span>}
                  </span>
                </div>
              ))}
            </div>

            <div className="pl-suggest">
              <span className="pl-suggest-label">{t('pl_suggested')}</span>
              {gaps.some(g => g.action !== 'HOLD') ? (
                <ul className="pl-suggest-list">
                  {gaps.filter(g => g.action !== 'HOLD').map(g => (
                    <li key={g.strategy}>{t(g.action === 'ADD' ? 'pl_suggest_buy' : 'pl_suggest_trim', { amount: money(Math.abs(g.deltaUsd)), strategy: t(`tax_${g.strategy}`) })}</li>
                  ))}
                </ul>
              ) : (
                <p className="pl-suggest-text">{t('pl_suggest_balanced')}</p>
              )}
            </div>
          </>
        )}
      </PanelBody>
    </Panel>
  )
}
