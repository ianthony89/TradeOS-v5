// ============================================================
//  TradeOS v5 — Portfolio Taxonomy
//  Classifies positions on three axes:
//    Strategy  — long-term character
//    Health    — current P/L state
//    Action    — suggested next move
//  Pure client-side compute from existing holding data.
// ============================================================

export type StrategyClass = 'CORE' | 'TACTICAL' | 'SPECULATIVE'
export type HealthClass   = 'HEALTHY' | 'WEAK' | 'DEAD'
export type ActionClass   = 'HOLD' | 'ADD' | 'REDUCE' | 'EXIT'

export interface ClassifyInput {
  symbol:          string
  name?:           string | null
  assetType:       string
  unrealizedPlPct: number
  portfolioWeight: number     // %, 0–100
}

const LEVERAGED_RE = /\b(2X|3X|LEVERAGE|LEVERAGED|BULL|BEAR|ULTRA|DAILY|DIREXION|GRANITESHARES)\b/i

/**
 * Strategy — long-term position character.
 *   CORE         Broad ETFs, indexes — buy-and-hold backbone.
 *   TACTICAL     Individual equities held with conviction.
 *   SPECULATIVE  Leveraged ETFs, crypto, penny stocks — high variance.
 */
export function classifyStrategy({ assetType, symbol, name }: ClassifyInput): StrategyClass {
  const label = `${symbol} ${name ?? ''}`
  if (assetType === 'CRYPTO')        return 'SPECULATIVE'
  if (LEVERAGED_RE.test(label))      return 'SPECULATIVE'
  if (assetType === 'ETF')           return 'CORE'
  if (assetType === 'INDEX')         return 'CORE'
  return 'TACTICAL'
}

/**
 * Health — current P/L state.
 *   HEALTHY  ≥ −15%
 *   WEAK     −50% to −15%
 *   DEAD     < −50%
 */
export function classifyHealth({ unrealizedPlPct }: ClassifyInput): HealthClass {
  if (unrealizedPlPct < -50) return 'DEAD'
  if (unrealizedPlPct < -15) return 'WEAK'
  return 'HEALTHY'
}

/**
 * Action — suggested next move (heuristic).
 *   EXIT     P/L < −50% (cut losses)
 *   REDUCE   weight > 25% (concentration risk) OR P/L < −25%
 *   ADD      P/L > 8% AND weight < 5% (winner with room to grow)
 *   HOLD     default
 */
export function classifyAction({ unrealizedPlPct, portfolioWeight }: ClassifyInput): ActionClass {
  if (unrealizedPlPct < -50)                            return 'EXIT'
  if (portfolioWeight > 25 || unrealizedPlPct < -25)    return 'REDUCE'
  if (unrealizedPlPct > 8 && portfolioWeight < 5)       return 'ADD'
  return 'HOLD'
}

/** Map classifications to badge tone classes. */
export const STRATEGY_TONE: Record<StrategyClass, 'accent' | 'positive' | 'warning'> = {
  CORE:         'positive',
  TACTICAL:     'accent',
  SPECULATIVE:  'warning',
}

export const HEALTH_TONE: Record<HealthClass, 'positive' | 'warning' | 'negative'> = {
  HEALTHY: 'positive',
  WEAK:    'warning',
  DEAD:    'negative',
}

export const ACTION_TONE: Record<ActionClass, 'neutral' | 'positive' | 'warning' | 'negative'> = {
  HOLD:   'neutral',
  ADD:    'positive',
  REDUCE: 'warning',
  EXIT:   'negative',
}
