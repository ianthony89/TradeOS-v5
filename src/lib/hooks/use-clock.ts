'use client'

import { useEffect, useState } from 'react'

/**
 * Re-renders the component every N ms (default 1s).
 * Used by market clocks, ticker strip, sync freshness indicators.
 */
export function useClock(intervalMs = 1000): number {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick(n => n + 1), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return tick
}
