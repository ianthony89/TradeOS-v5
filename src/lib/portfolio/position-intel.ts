// ============================================================
//  TradeOS v5 — Position Intelligence data layer (Phase 2A)
//  Client-side Supabase access (RLS owner-only). No API route.
//  Keyed by (user_id, symbol_normalized) so the thesis survives a
//  CSV re-import or a full exit, and a future cross-position page can
//  read the same rows without a symbol filter.
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js'

// ── Investment Thesis + Target Planner (one 1:1 row) ──────────
export interface PositionIntel {
  thesis:           string
  bullCase:         string
  bearCase:         string
  invalidation:     string
  thesisUpdatedAt:  string | null
  targetPrice:      number | null
  trimAbove:        number | null
  addBelow:         number | null
  fairValue:        number | null
  targetCurrency:   string
  planNotes:        string
  targetsUpdatedAt: string | null
}

export const EMPTY_INTEL: PositionIntel = {
  thesis: '', bullCase: '', bearCase: '', invalidation: '', thesisUpdatedAt: null,
  targetPrice: null, trimAbove: null, addBelow: null, fairValue: null,
  targetCurrency: 'USD', planNotes: '', targetsUpdatedAt: null,
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function num(v: any): number | null { return v == null || v === '' ? null : Number(v) }

function fromRow(r: any): PositionIntel {
  return {
    thesis:           r.thesis        ?? '',
    bullCase:         r.bull_case     ?? '',
    bearCase:         r.bear_case     ?? '',
    invalidation:     r.invalidation  ?? '',
    thesisUpdatedAt:  r.thesis_updated_at  ?? null,
    targetPrice:      num(r.target_price),
    trimAbove:        num(r.trim_above),
    addBelow:         num(r.add_below),
    fairValue:        num(r.fair_value),
    targetCurrency:   r.target_currency ?? 'USD',
    planNotes:        r.plan_notes     ?? '',
    targetsUpdatedAt: r.targets_updated_at ?? null,
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function loadPositionIntel(
  sb: SupabaseClient, userId: string, symbolNorm: string,
): Promise<PositionIntel | null> {
  const { data } = await sb
    .from('position_intelligence')
    .select('*')
    .eq('user_id', userId)
    .eq('symbol_normalized', symbolNorm)
    .maybeSingle()
  return data ? fromRow(data) : null
}

type ThesisFields  = Pick<PositionIntel, 'thesis' | 'bullCase' | 'bearCase' | 'invalidation'>
type TargetFields  = Pick<PositionIntel, 'targetPrice' | 'trimAbove' | 'addBelow' | 'fairValue' | 'targetCurrency' | 'planNotes'>

/** Upsert only the thesis columns (targets untouched), stamp thesis_updated_at. */
export async function saveThesis(
  sb: SupabaseClient, userId: string, symbol: string, symbolNorm: string, f: ThesisFields,
): Promise<void> {
  await sb.from('position_intelligence').upsert({
    user_id: userId, symbol, symbol_normalized: symbolNorm,
    thesis: f.thesis, bull_case: f.bullCase, bear_case: f.bearCase, invalidation: f.invalidation,
    thesis_updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,symbol_normalized' })
}

/** Upsert only the target columns (thesis untouched), stamp targets_updated_at. */
export async function saveTargets(
  sb: SupabaseClient, userId: string, symbol: string, symbolNorm: string, f: TargetFields,
): Promise<void> {
  await sb.from('position_intelligence').upsert({
    user_id: userId, symbol, symbol_normalized: symbolNorm,
    target_price: f.targetPrice, trim_above: f.trimAbove, add_below: f.addBelow,
    fair_value: f.fairValue, target_currency: f.targetCurrency, plan_notes: f.planNotes,
    targets_updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,symbol_normalized' })
}

// ── Decision Log (reuses journal_entries) ─────────────────────
// entry_type doubles as the decision kind. Phase 2A only writes 'manual';
// the rest are reserved for future automation (opened / added / reduced /
// exited / thesis_updated / target_updated). 'opened'/'thesis_updated'/
// 'target_updated' are also synthesized client-side from timestamps below.
export type DecisionKind =
  | 'manual' | 'opened' | 'added' | 'reduced' | 'exited'
  | 'thesis_updated' | 'target_updated' | 'review'

export interface DecisionEntry {
  id:         string
  kind:       DecisionKind
  body:       string
  at:         string          // ISO timestamp
  synthetic?: boolean         // derived milestone, not a stored row
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function loadDecisionLog(
  sb: SupabaseClient, userId: string, symbolNorm: string,
): Promise<DecisionEntry[]> {
  const { data } = await sb
    .from('journal_entries')
    .select('id, content, title, entry_type, created_at')
    .eq('user_id', userId)
    .eq('symbol', symbolNorm)
    .order('created_at', { ascending: false })
  return (data ?? []).map((r: any) => ({
    id:   r.id,
    kind: (r.entry_type ?? 'manual') as DecisionKind,
    body: r.content ?? r.title ?? '',
    at:   r.created_at,
  }))
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function addReview(
  sb: SupabaseClient, userId: string, symbolNorm: string, body: string,
): Promise<void> {
  await sb.from('journal_entries').insert({
    user_id: userId, symbol: symbolNorm, content: body, entry_type: 'manual',
  })
}

export async function deleteDecision(sb: SupabaseClient, id: string): Promise<void> {
  await sb.from('journal_entries').delete().eq('id', id)
}

/**
 * Phase 2A milestones are synthesized from timestamps we already have
 * (no stored rows). Once automation lands these become real journal rows
 * and this helper can be dropped. Bodies are localized in the UI.
 */
export function synthesizeMilestones(opts: {
  openedAt?:         string | null
  thesisUpdatedAt?:  string | null
  targetsUpdatedAt?: string | null
}): DecisionEntry[] {
  const out: DecisionEntry[] = []
  if (opts.openedAt)         out.push({ id: 'm-opened',  kind: 'opened',         body: '', at: opts.openedAt,         synthetic: true })
  if (opts.thesisUpdatedAt)  out.push({ id: 'm-thesis',  kind: 'thesis_updated', body: '', at: opts.thesisUpdatedAt,  synthetic: true })
  if (opts.targetsUpdatedAt) out.push({ id: 'm-targets', kind: 'target_updated', body: '', at: opts.targetsUpdatedAt, synthetic: true })
  return out
}

/** Merge stored entries + synthesized milestones, newest first. */
export function mergeDecisionLog(stored: DecisionEntry[], milestones: DecisionEntry[]): DecisionEntry[] {
  return [...stored, ...milestones].sort((a, b) => (a.at < b.at ? 1 : -1))
}
