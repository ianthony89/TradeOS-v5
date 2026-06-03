// ============================================================
//  TradeOS v5 — Planner (Phase 2D)
//  Portfolio Action Simulator. Pure, deterministic portfolio math
//  on existing holdings — no prediction, no AI, no writes.
//  Everything is computed in a USD base; the page converts to the
//  display currency. (Strategy bucketing is mirrored here so the
//  frozen Dashboard isn't touched.)
// ============================================================

import type { StrategyClass } from './taxonomy'

export const STRATEGIES: StrategyClass[] = ['CORE', 'TACTICAL', 'SPECULATIVE']
export type StrategyTarget = Record<StrategyClass, number>   // percent, sums to 100

export interface PlannerPosition {
  symbol:           string
  symbolNormalized: string
  name:             string
  currency:         string
  usdValue:         number      // market value in USD
  priceUsd:         number      // unit price in USD
  weight:           number      // % of portfolio, 0–100
  strategy:         StrategyClass
}

export interface DeploySuggestion {
  symbol:           string
  symbolNormalized: string
  name:             string
  currency:         string
  strategy:         StrategyClass
  addUsd:           number
  addShares:        number
  weightBefore:     number
  weightAfter:      number
}

export interface DeployResult {
  suggestions:  DeploySuggestion[]
  deployedUsd:  number
  undeployedUsd: number          // cash that couldn't be placed (e.g. a targeted strategy with no positions)
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

export function bucketByStrategy(positions: PlannerPosition[]): StrategyTarget {
  const out: StrategyTarget = { CORE: 0, TACTICAL: 0, SPECULATIVE: 0 }
  for (const p of positions) out[p.strategy] += p.usdValue
  return out
}

function suggestion(p: PlannerPosition, addUsd: number, newTotal: number): DeploySuggestion {
  return {
    symbol: p.symbol, symbolNormalized: p.symbolNormalized, name: p.name, currency: p.currency, strategy: p.strategy,
    addUsd, addShares: p.priceUsd > 0 ? addUsd / p.priceUsd : 0,
    weightBefore: p.weight, weightAfter: newTotal > 0 ? ((p.usdValue + addUsd) / newTotal) * 100 : 0,
  }
}

/**
 * Add Capital · "Current Portfolio" — deploy cash proportionally to existing
 * weights (keeps your allocation shape intact).
 */
export function deployProportional(positions: PlannerPosition[], cashUsd: number): DeployResult {
  const total = sum(positions.map(p => p.usdValue))
  if (total <= 0 || cashUsd <= 0) return { suggestions: [], deployedUsd: 0, undeployedUsd: cashUsd }
  const newTotal = total + cashUsd
  const suggestions = positions
    .map(p => suggestion(p, cashUsd * (p.usdValue / total), newTotal))
    .filter(s => s.addUsd > 0)
    .sort((a, b) => b.addUsd - a.addUsd)
  return { suggestions, deployedUsd: sum(suggestions.map(s => s.addUsd)), undeployedUsd: 0 }
}

/**
 * Add Capital · "Strategy Target" — deploy cash toward Core/Tactical/Speculative
 * gaps (buy only; can't sell with new cash). A targeted strategy with no
 * positions leaves that share of cash undeployed (surfaced, not hidden).
 */
export function deployStrategyTarget(
  positions: PlannerPosition[], cashUsd: number, target: StrategyTarget,
): DeployResult {
  const total = sum(positions.map(p => p.usdValue))
  if (total <= 0 || cashUsd <= 0) return { suggestions: [], deployedUsd: 0, undeployedUsd: cashUsd }
  const newTotal = total + cashUsd
  const current = bucketByStrategy(positions)

  const gaps = STRATEGIES.map(s => ({ s, gap: Math.max(0, (target[s] / 100) * newTotal - current[s]) }))
  const totalGap = sum(gaps.map(g => g.gap))

  // cash assigned to each strategy bucket
  const perStrat: StrategyTarget = { CORE: 0, TACTICAL: 0, SPECULATIVE: 0 }
  if (totalGap <= 0) {
    for (const s of STRATEGIES) perStrat[s] = cashUsd * (target[s] / 100)     // already at/over target → by target weight
  } else if (cashUsd <= totalGap) {
    for (const g of gaps) perStrat[g.s] = cashUsd * (g.gap / totalGap)        // partial fill, proportional to gap
  } else {
    for (const g of gaps) perStrat[g.s] = g.gap                              // fill gaps, then remainder by target
    const remainder = cashUsd - totalGap
    for (const s of STRATEGIES) perStrat[s] += remainder * (target[s] / 100)
  }

  const suggestions: DeploySuggestion[] = []
  for (const s of STRATEGIES) {
    const inStrat = positions.filter(p => p.strategy === s)
    const stratVal = sum(inStrat.map(p => p.usdValue))
    if (perStrat[s] <= 0 || inStrat.length === 0) continue                   // no positions → can't deploy here
    for (const p of inStrat) {
      const share = stratVal > 0 ? p.usdValue / stratVal : 1 / inStrat.length
      suggestions.push(suggestion(p, perStrat[s] * share, newTotal))
    }
  }
  suggestions.sort((a, b) => b.addUsd - a.addUsd)
  const deployedUsd = sum(suggestions.map(s => s.addUsd))
  return { suggestions, deployedUsd, undeployedUsd: Math.max(0, cashUsd - deployedUsd) }
}

export interface ReduceResult {
  sellUsd:    number
  sellShares: number
  newWeight:  number
  freedUsd:   number
}

/**
 * Reduce Concentration — sell down a single position to a target weight.
 * Total is held constant (freed value becomes cash/dry powder). Returns null
 * when the position is already at/under the target.
 */
export function reduceToWeight(position: PlannerPosition, targetPct: number, totalUsd: number): ReduceResult | null {
  const sellUsd = position.usdValue - (targetPct / 100) * totalUsd
  if (sellUsd <= 0) return null
  return {
    sellUsd,
    sellShares: position.priceUsd > 0 ? sellUsd / position.priceUsd : 0,
    newWeight: targetPct,
    freedUsd: sellUsd,
  }
}

export interface StrategyGapRow {
  strategy:   StrategyClass
  currentPct: number
  targetPct:  number
  gapPct:     number
  action:     'ADD' | 'REDUCE' | 'HOLD'
  deltaUsd:   number      // signed: + = buy, − = trim
}

/** Target Allocation (Strategy) — current vs target gap + a Buy/Trim/Hold action per bucket. */
export function strategyGap(positions: PlannerPosition[], target: StrategyTarget): StrategyGapRow[] {
  const total = sum(positions.map(p => p.usdValue))
  const current = bucketByStrategy(positions)
  return STRATEGIES.map(s => {
    const currentPct = total > 0 ? (current[s] / total) * 100 : 0
    const gapPct = target[s] - currentPct
    return {
      strategy: s, currentPct, targetPct: target[s], gapPct,
      action: gapPct > 1 ? 'ADD' : gapPct < -1 ? 'REDUCE' : 'HOLD',
      deltaUsd: (gapPct / 100) * total,
    }
  })
}
