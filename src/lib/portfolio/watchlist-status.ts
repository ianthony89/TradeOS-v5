// ============================================================
//  TradeOS v5 — Watchlist Radar Status
//  Pure functions. Computes how close a watched symbol is to its
//  target and what status the radar should show.
//
//  Statuses (only what can be honestly derived from price):
//    WATCHING      — target still far away
//    NEAR_TARGET   — within NEAR_THRESHOLD% of target
//    TRIGGERED     — target reached/crossed in the watched direction
//
//  Note: "Expired" is intentionally NOT implemented — it requires a
//  target-expiry date that the schema does not carry. Revisit if a
//  target_date column is added.
// ============================================================

export type WatchStatus    = 'WATCHING' | 'NEAR_TARGET' | 'TRIGGERED'
export type WatchDirection = 'above' | 'below'

export interface WatchStatusResult {
  status:      WatchStatus
  direction:   WatchDirection
  /** Signed % move from current to target (positive = target above current). */
  distancePct: number
  reached:     boolean
}

const NEAR_THRESHOLD = 5   // within 5% of target counts as "near"

/**
 * @param current   Live price (0 if unknown / quote not yet loaded)
 * @param target    User's target price
 * @param stored    Persisted direction, if any. Falls back to inference.
 */
export function computeWatchStatus(
  current: number,
  target: number,
  stored?: WatchDirection | null,
): WatchStatusResult {
  // Infer direction when not persisted: target above current → breakout watch.
  const direction: WatchDirection =
    stored ?? (target >= current ? 'above' : 'below')

  const distancePct = current > 0 ? ((target - current) / current) * 100 : 0

  const reached =
    current <= 0      ? false :
    direction === 'above' ? current >= target
                          : current <= target

  let status: WatchStatus
  if (reached)                                  status = 'TRIGGERED'
  else if (Math.abs(distancePct) <= NEAR_THRESHOLD) status = 'NEAR_TARGET'
  else                                          status = 'WATCHING'

  return { status, direction, distancePct, reached }
}

/** Badge tone per status. */
export const WATCH_STATUS_TONE: Record<WatchStatus, 'neutral' | 'warning' | 'accent'> = {
  WATCHING:    'neutral',
  NEAR_TARGET: 'warning',
  TRIGGERED:   'accent',
}
