// ============================================================
//  TradeOS v5 — Position Quality (shared, Phase 2C)
//  Pure 5-dimension completeness grade, mirrored from the Position
//  Hub's inline model. The Hub is frozen and keeps its own copy;
//  the Review Hub uses this shared version. Keep the two in sync.
//
//  Dimensions: thesis · target plan · decision log · conviction ·
//  review schedule → A+/A/B/C/D.
// ============================================================

import type { PositionIntel } from './position-intel'

export type QualityGrade = 'A+' | 'A' | 'B' | 'C' | 'D'

export interface QualityResult {
  score: number          // 0–5 dimensions complete
  grade: QualityGrade
}

export function positionQuality(
  intel: PositionIntel | undefined,
  hasLogEntry: boolean,
): QualityResult {
  const dims = [
    !!intel && !!(intel.thesis || intel.bullCase || intel.bearCase || intel.invalidation),
    !!intel && (intel.targetPrice != null || intel.trimAbove != null || intel.addBelow != null || intel.fairValue != null),
    hasLogEntry,
    !!intel && !!intel.confidence,
    !!intel && intel.reviewFrequencyDays != null,
  ]
  const score = dims.filter(Boolean).length
  const grade: QualityGrade =
    score >= 5 ? 'A+' : score === 4 ? 'A' : score === 3 ? 'B' : score === 2 ? 'C' : 'D'
  return { score, grade }
}
