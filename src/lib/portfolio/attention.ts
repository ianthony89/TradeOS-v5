// ============================================================
//  TradeOS v5 — Attention Engine (Phase 2B)
//  Rules-based (no AI). Fuses price facts + Phase 2A intelligence
//  (review schedule, thesis/target completeness) + watchlist
//  triggers into ONE prioritized feed: "What needs my attention
//  today?". Supersedes the old action-center.ts.
//
//  Each item carries i18n keys + vars (page renders localized text)
//  and an href so the Dashboard (Attention Layer) deep-links into
//  the Position Hub (Decision Layer). Watchlist items link to the
//  Watchlist (unowned symbols have no Hub page).
// ============================================================

import { reviewStatus } from './review-status'

export type AttentionSeverity = 'critical' | 'warning' | 'info'
export type AttentionIcon = 'loss' | 'concentration' | 'review' | 'thesis' | 'target' | 'watch'

export interface AttentionItem {
  key:        string
  /** Ordering rank (v5.0.6): 0 EXIT/-50% · 1 REDUCE · 2 Review · 3 other. Lower = higher. */
  rank:       number
  severity:   AttentionSeverity
  icon:       AttentionIcon
  titleKey:   string
  titleVars:  Record<string, string | number>
  detailKey:  string
  detailVars: Record<string, string | number>
  href:       string
}

export interface AttentionPosition {
  symbol:           string
  symbolNormalized: string
  unrealizedPlPct:  number
  portfolioWeight:  number          // %, 0–100
  hasThesis:        boolean
  hasTargets:       boolean
  nextReviewAt:     string | null
}

export interface AttentionInput {
  positions:      AttentionPosition[]
  /** symbolNormalized of the Top-N by weight (missing thesis/targets only fire here). */
  topByWeight:    Set<string>
  /** Watchlist symbols already filtered to TRIGGERED. */
  watchTriggered: string[]
  fmtPct:         (v: number) => string
}

const MAX_ITEMS = 5
const PRIORITY: Record<AttentionSeverity, number> = { critical: 0, warning: 1, info: 2 }

/**
 * The single most important signal for one position (first match wins), so a
 * troubled position contributes ONE line, never three. Returns null when the
 * position needs no attention.
 */
function positionSignal(
  p: AttentionPosition,
  topByWeight: Set<string>,
  fmtPct: (v: number) => string,
): AttentionItem | null {
  const href = `/holdings/${encodeURIComponent(p.symbolNormalized)}`
  const rs   = reviewStatus(p.nextReviewAt)

  // Priority order (v5.0.6): EXIT / -50% → REDUCE → Review → other.
  // First match wins, so a troubled position contributes ONE line.

  // 1 (EXIT / below -50%) — deep loss, thesis likely broken.
  if (p.unrealizedPlPct < -50) {
    return {
      key: `loss-${p.symbol}`, rank: 0, severity: 'critical', icon: 'loss',
      titleKey: 'attn_broken', titleVars: { symbol: p.symbol },
      detailKey: 'attn_broken_d', detailVars: { pct: fmtPct(Math.abs(p.unrealizedPlPct)) }, href,
    }
  }
  // 2 (REDUCE) — one position too large.
  if (p.portfolioWeight > 25) {
    return {
      key: `conc-${p.symbol}`, rank: 1, severity: 'warning', icon: 'concentration',
      titleKey: 'attn_reduce', titleVars: { symbol: p.symbol },
      detailKey: 'attn_reduce_d', detailVars: { pct: fmtPct(p.portfolioWeight) }, href,
    }
  }
  // 3 (Review due) — overdue first, then due/soon.
  if (rs?.state === 'overdue') {
    return {
      key: `rev-${p.symbol}`, rank: 2, severity: 'critical', icon: 'review',
      titleKey: 'attn_review_overdue', titleVars: { symbol: p.symbol },
      detailKey: 'attn_review_overdue_d', detailVars: { n: Math.abs(rs.days) }, href,
    }
  }
  if (rs?.state === 'due' || rs?.state === 'soon') {
    return {
      key: `rev-${p.symbol}`, rank: 2, severity: 'warning', icon: 'review',
      titleKey: 'attn_review_due', titleVars: { symbol: p.symbol },
      detailKey: rs.state === 'due' ? 'attn_review_due_today' : 'attn_review_due_d',
      detailVars: { n: rs.days }, href,
    }
  }
  // 4 (other) — meaningful drawdown, then documentation gaps (Top-N only).
  if (p.unrealizedPlPct < -25) {
    return {
      key: `draw-${p.symbol}`, rank: 3, severity: 'warning', icon: 'loss',
      titleKey: 'attn_drawdown', titleVars: { symbol: p.symbol },
      detailKey: 'attn_drawdown_d', detailVars: { pct: fmtPct(Math.abs(p.unrealizedPlPct)) }, href,
    }
  }
  if (topByWeight.has(p.symbolNormalized)) {
    if (!p.hasThesis) {
      return {
        key: `thesis-${p.symbol}`, rank: 3, severity: 'warning', icon: 'thesis',
        titleKey: 'attn_missing_thesis', titleVars: { symbol: p.symbol },
        detailKey: 'attn_missing_thesis_d', detailVars: { pct: fmtPct(p.portfolioWeight) }, href,
      }
    }
    if (!p.hasTargets) {
      return {
        key: `target-${p.symbol}`, rank: 3, severity: 'warning', icon: 'target',
        titleKey: 'attn_missing_targets', titleVars: { symbol: p.symbol },
        detailKey: 'attn_missing_targets_d', detailVars: { pct: fmtPct(p.portfolioWeight) }, href,
      }
    }
  }
  return null
}

/**
 * Build the prioritized attention feed. Stable: ties keep input order, so the
 * feed doesn't reshuffle on every quote refresh.
 */
export function buildAttentionFeed(input: AttentionInput): AttentionItem[] {
  const { positions, topByWeight, watchTriggered, fmtPct } = input
  const out: AttentionItem[] = []

  for (const p of positions) {
    const item = positionSignal(p, topByWeight, fmtPct)
    if (item) out.push(item)
  }

  // Watchlist triggers — unowned symbols, link to the Watchlist.
  for (const symbol of watchTriggered) {
    out.push({
      key: `watch-${symbol}`, rank: 4, severity: 'info', icon: 'watch',
      titleKey: 'attn_watch', titleVars: { symbol },
      detailKey: 'attn_watch_d', detailVars: {}, href: '/watchlist',
    })
  }

  // Order by explicit rank (EXIT → REDUCE → Review → other), then severity,
  // then input order — stable, so the feed doesn't reshuffle on every refresh.
  return out
    .map((it, i) => ({ it, i }))
    .sort((a, b) => a.it.rank - b.it.rank || PRIORITY[a.it.severity] - PRIORITY[b.it.severity] || a.i - b.i)
    .map(x => x.it)
    .slice(0, MAX_ITEMS)
}
