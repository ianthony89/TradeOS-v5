// ============================================================
//  TradeOS v5 — Portfolio Risk Score
//  Transparent, deterministic. No fake numbers (AGENTS.md § trust).
// ============================================================

export type RiskLevel = 'low' | 'moderate' | 'high'

export interface RiskScore {
  score:   number      // 0–100 (higher = riskier)
  level:   RiskLevel
  factors: {
    /** Sub-scores, each 0–100. */
    concentration: number
    speculative:   number
    drawdown:      number
  }
}

const clamp = (v: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, v))

/**
 * Risk score = 0.40·concentration + 0.35·speculative + 0.25·drawdown.
 *  - concentration: largest single position weight (50%+ in one name → 100)
 *  - speculative:   SPECULATIVE-class weight as a % of book
 *  - drawdown:      % of book sitting in positions down > 50% (25%+ → 100)
 */
export function computeRiskScore(input: {
  maxWeight:         number   // %
  speculativeWeight: number   // %
  brokenWeight:      number   // % of book in names down > 50%
}): RiskScore {
  const concentration = clamp((input.maxWeight / 50) * 100)
  const speculative   = clamp(input.speculativeWeight)
  const drawdown      = clamp((input.brokenWeight / 25) * 100)

  const score = Math.round(clamp(
    0.40 * concentration + 0.35 * speculative + 0.25 * drawdown,
  ))
  const level: RiskLevel = score < 34 ? 'low' : score < 67 ? 'moderate' : 'high'

  return { score, level, factors: { concentration, speculative, drawdown } }
}
