'use client'

import { Info } from 'lucide-react'
import type { ReactNode } from 'react'

interface InfoTooltipProps {
  content:   ReactNode
  size?:     number
  /** Where the bubble anchors relative to the icon. 'left' keeps it on-panel
   *  for left-edge labels (e.g. shorter ZH headings); 'center' is the default. */
  align?:    'center' | 'left' | 'right'
  className?: string
}

/**
 * Lightweight CSS-driven help tooltip. Reveals on hover or keyboard focus
 * (focus-within), so it is accessible without any JS state.
 */
export function InfoTooltip({ content, size = 12, align = 'center', className = '' }: InfoTooltipProps) {
  return (
    <span className={`info-tooltip ${className}`} tabIndex={0}>
      <Info size={size} className="info-tooltip-trigger" />
      <span className={`info-tooltip-content info-tooltip-content--${align}`} role="tooltip">
        {content}
      </span>
    </span>
  )
}
