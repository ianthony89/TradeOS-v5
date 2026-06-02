// ============================================================
//  TradeOS v5 — Review status (Phase 2B)
//  Pure helpers for the per-position review schedule. Shared by the
//  Dashboard Attention Feed + Review Queue. (The Position Hub keeps
//  its own inline copy — it is frozen and not touched here.)
// ============================================================

export type ReviewState = 'overdue' | 'due' | 'soon' | 'ok'

export interface ReviewStatus {
  state: ReviewState
  tone:  'negative' | 'warning' | 'positive'
  days:  number   // whole days until due; negative = days overdue
}

const DAY = 86_400_000

/** Whole days from now until `iso` (negative = in the past). Null if no date. */
export function daysUntil(iso: string | null): number | null {
  if (!iso) return null
  return Math.round((new Date(iso).getTime() - Date.now()) / DAY)
}

/**
 * Bucket a next-review date into overdue / due (today) / soon (<7d) / ok.
 * Returns null when no review cadence is set.
 */
export function reviewStatus(nextReviewAt: string | null): ReviewStatus | null {
  if (!nextReviewAt) return null
  const diff = new Date(nextReviewAt).getTime() - Date.now()
  const days = Math.round(diff / DAY)
  if (diff < 0)         return { state: 'overdue', tone: 'negative', days }
  if (diff < DAY)       return { state: 'due',     tone: 'warning',  days }
  if (diff < 7 * DAY)   return { state: 'soon',    tone: 'warning',  days }
  return { state: 'ok', tone: 'positive', days }
}
