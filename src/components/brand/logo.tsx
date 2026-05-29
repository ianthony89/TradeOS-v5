'use client'

import { useId } from 'react'

interface LogoProps {
  size?:      number
  className?: string
  /** Optional drop-shadow glow — use on auth hero, splash. */
  glow?:      boolean
}

/**
 * TradeOS brand mark.
 *
 * Design notes:
 *   • Bold confident "T" letterform — slightly wider crossbar for
 *     architectural weight, narrow stem for elegance.
 *   • Upward-trend arrow placed in the upper-right negative space.
 *     Well-separated from the T body so both elements have room to breathe.
 *   • Arrow is geometrically precise (45° + horizontal/vertical cap),
 *     evoking a chart-line resolution moment rather than a generic arrow.
 *   • Gradient (accent → accent-2) reads from theme tokens so the mark
 *     adapts to dark/light without recolouring.
 *   • Renders crisp at 16px (favicon) up through 128px+.
 */
export function Logo({ size = 32, className = '', glow = false }: LogoProps) {
  const gradId = `tradeos-logo-${useId().replace(/:/g, '')}`

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="TradeOS"
      style={{
        display: 'block',
        filter: glow ? 'drop-shadow(0 0 14px var(--accent-glow))' : undefined,
      }}
    >
      <defs>
        <linearGradient
          id={gradId}
          x1="3"  y1="3"
          x2="29" y2="29"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%"   stopColor="var(--accent)" />
          <stop offset="100%" stopColor="var(--accent-2)" />
        </linearGradient>
      </defs>

      {/* T letterform — single closed path, sharp inside corners */}
      <path
        d="M 4 6 H 21 V 10.5 H 14.75 V 25.5 H 10.25 V 10.5 H 4 Z"
        fill={`url(#${gradId})`}
      />

      {/* Upward trend arrow — separated from T body, premium geometry */}
      <g
        stroke={`url(#${gradId})`}
        strokeWidth="2.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      >
        <path d="M 17.5 18.5 L 26.5 9.5" />
        <path d="M 21.5 9.5 L 26.5 9.5 L 26.5 14.5" />
      </g>
    </svg>
  )
}
