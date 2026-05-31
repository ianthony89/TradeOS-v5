'use client'

import { useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export interface TipState {
  x:      number
  y:      number
  name:   string
  detail: string
  /** 'data' (default) = compact value tooltip; 'prose' = wrapped explanatory text. */
  variant?: 'data' | 'prose'
}

/**
 * Tiny shared hover-tooltip used by every chart (treemap, donut, bars,
 * histogram, …). Keeps each chart self-contained — no prop drilling.
 * setState happens only inside event handlers, so it's React-Compiler clean.
 */
export function useChartTooltip() {
  const [tip, setTip] = useState<TipState | null>(null)
  return {
    tip,
    show: (e: { clientX: number; clientY: number }, name: string, detail: string, variant: 'data' | 'prose' = 'data') =>
      setTip({ x: e.clientX, y: e.clientY, name, detail, variant }),
    move: (e: { clientX: number; clientY: number }) =>
      setTip(t => (t ? { ...t, x: e.clientX, y: e.clientY } : t)),
    hide: () => setTip(null),
  }
}

export function ChartTooltip({ tip }: { tip: TipState | null }) {
  if (!tip || typeof document === 'undefined') return null
  return createPortal(
    <div className={`chart-tip${tip.variant === 'prose' ? ' chart-tip--prose' : ''}`} style={{ left: tip.x + 14, top: tip.y + 14 }}>
      <span className="chart-tip-name">{tip.name}</span>
      <span className="chart-tip-detail">{tip.detail}</span>
    </div>,
    document.body,
  )
}

/** Convenience wrapper so a chart can render its tooltip in one line. */
export function ChartTooltipLayer({ children }: { children: ReactNode }) {
  return <>{children}</>
}
