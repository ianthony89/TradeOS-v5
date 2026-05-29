'use client'

import { useEffect } from 'react'
import { useMarketStore } from '@/stores/market'

const REFRESH_MS = 5 * 60 * 1000   // 5 minutes — FX moves slowly

/**
 * FX sync loop.
 *
 * Only runs when the user has opted into live mode via Settings.
 * In manual mode the loop is dormant — the manual rate is used as-is.
 *
 * Mount once at the app shell. Consumers read the active rate via
 * `useMarketStore(selectActiveFxRate)`.
 */
export function useFxRateSync(pair = 'USDMYR') {
  const fxMode    = useMarketStore(s => s.fxMode)
  const setFxLive = useMarketStore(s => s.setFxLiveRate)

  useEffect(() => {
    if (fxMode !== 'live') return    // Manual mode — no live fetching

    let mounted = true

    async function fetchFx() {
      try {
        const res = await fetch(
          `/api/quotes?symbols=${encodeURIComponent(`${pair}=X`)}`,
          { cache: 'no-store' },
        )
        const json = await res.json()
        const px   = json.quotes?.[0]?.price
        if (mounted && Number.isFinite(px) && px > 0) {
          setFxLive(px as number, new Date())
        }
      } catch { /* keep last known rate */ }
    }

    fetchFx()
    const id = setInterval(fetchFx, REFRESH_MS)
    return () => { mounted = false; clearInterval(id) }
  }, [pair, fxMode, setFxLive])
}
