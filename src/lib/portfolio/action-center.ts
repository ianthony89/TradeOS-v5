// ============================================================
//  TradeOS v5 — Action Center
//  Rules-based (no AI/LLM). Turns portfolio facts into a short,
//  prioritized list of imperative action suggestions.
//
//  Answers: "What deserves my attention today?"
//  Capped at MAX_ACTIONS. Returns i18n keys + vars — the page
//  renders the localized text (§8 strict localization).
// ============================================================

export type ActionPriority = 'critical' | 'warning' | 'info'

export interface ActionInput {
  symbol:          string
  unrealizedPlPct: number
  portfolioWeight: number   // %, 0–100
}

export interface SectorInput {
  name: string
  pct:  number              // %, 0–100
}

export interface ActionSuggestion {
  key:        string
  priority:   ActionPriority
  icon:       'concentration' | 'loss' | 'sector'
  titleKey:   string
  titleVars:  Record<string, string | number>
  detailKey:  string
  detailVars: Record<string, string | number>
}

const MAX_ACTIONS = 3

const PRIORITY_RANK: Record<ActionPriority, number> = {
  critical: 0,
  warning:  1,
  info:     2,
}

/**
 * Build prioritized action suggestions.
 * `fmtPct` formats a percentage value the same way the rest of the UI does.
 */
export function buildActionSuggestions(
  positions: ActionInput[],
  sectors:   SectorInput[],
  fmtPct:    (v: number) => string,
): ActionSuggestion[] {
  const out: ActionSuggestion[] = []

  for (const p of positions) {
    // Exit candidate — thesis likely broken
    if (p.unrealizedPlPct < -50) {
      out.push({
        key: `exit-${p.symbol}`, priority: 'critical', icon: 'loss',
        titleKey: 'action_exit', titleVars: { symbol: p.symbol },
        detailKey: 'action_exit_d', detailVars: { pct: fmtPct(Math.abs(p.unrealizedPlPct)) },
      })
    }
    // Concentration — single position too large
    else if (p.portfolioWeight > 25) {
      out.push({
        key: `reduce-${p.symbol}`, priority: 'warning', icon: 'concentration',
        titleKey: 'action_reduce', titleVars: { symbol: p.symbol },
        detailKey: 'action_reduce_d', detailVars: { pct: fmtPct(p.portfolioWeight) },
      })
    }
    // Review — meaningful drawdown but not yet exit territory
    else if (p.unrealizedPlPct < -25) {
      out.push({
        key: `review-${p.symbol}`, priority: 'warning', icon: 'loss',
        titleKey: 'action_review', titleVars: { symbol: p.symbol },
        detailKey: 'action_review_d', detailVars: { pct: fmtPct(Math.abs(p.unrealizedPlPct)) },
      })
    }
  }

  // Sector concentration — diversification nudge
  for (const s of sectors) {
    if (s.pct > 70) {
      out.push({
        key: `sector-${s.name}`, priority: 'info', icon: 'sector',
        titleKey: 'action_diversify', titleVars: { sector: s.name },
        detailKey: 'action_diversify_d', detailVars: { pct: fmtPct(s.pct) },
      })
    }
  }

  return out
    .sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority])
    .slice(0, MAX_ACTIONS)
}
