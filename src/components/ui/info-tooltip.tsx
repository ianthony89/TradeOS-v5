'use client'

import { Info } from 'lucide-react'
import type { ReactNode } from 'react'

interface InfoTooltipProps {
  content:   ReactNode
  size?:     number
  className?: string
}

/**
 * Lightweight CSS-driven help tooltip. Reveals on hover or keyboard focus
 * (focus-within), so it is accessible without any JS state.
 */
export function InfoTooltip({ content, size = 12, className = '' }: InfoTooltipProps) {
  return (
    <span className={`info-tooltip ${className}`} tabIndex={0}>
      <Info size={size} className="info-tooltip-trigger" />
      <span className="info-tooltip-content" role="tooltip">
        {content}
      </span>
    </span>
  )
}
