'use client'

import { useId } from 'react'

interface FlagProps {
  size?:      number
  className?: string
}

/** Malaysia flag — clean inline SVG for inline badge use. */
export function FlagMY({ size = 12, className = '' }: FlagProps) {
  const id = `flag-my-${useId().replace(/:/g, '')}`
  const w  = Math.round(size * 1.4)
  return (
    <svg
      width={w}
      height={size}
      viewBox="0 0 28 20"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Malaysia"
      style={{ display: 'inline-block', flexShrink: 0 }}
    >
      <defs>
        <clipPath id={id}>
          <rect x="0" y="0" width="28" height="20" rx="2" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id})`}>
        <rect width="28" height="20" fill="#fff" />
        {[0, 2, 4, 6, 8, 10, 12].map(i => (
          <rect key={i} x="0" y={(i * 20) / 14} width="28" height={20 / 14} fill="#cc0001" />
        ))}
        <rect x="0" y="0" width="13" height={(20 * 8) / 14} fill="#010066" />
        <circle cx="5"   cy="5.6" r="2.6" fill="#fc0" />
        <circle cx="6.2" cy="5.6" r="2.1" fill="#010066" />
        <path
          d="M9.7 3.6 L10.15 5 L11.55 5 L10.4 5.85 L10.85 7.25 L9.7 6.4 L8.55 7.25 L9 5.85 L7.85 5 L9.25 5 Z"
          fill="#fc0"
        />
      </g>
    </svg>
  )
}

/** US flag — clean inline SVG for inline badge use. */
export function FlagUS({ size = 12, className = '' }: FlagProps) {
  const id = `flag-us-${useId().replace(/:/g, '')}`
  const w  = Math.round(size * 1.4)
  return (
    <svg
      width={w}
      height={size}
      viewBox="0 0 28 20"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="United States"
      style={{ display: 'inline-block', flexShrink: 0 }}
    >
      <defs>
        <clipPath id={id}>
          <rect x="0" y="0" width="28" height="20" rx="2" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id})`}>
        <rect width="28" height="20" fill="#b22234" />
        {[1, 3, 5, 7, 9, 11].map(i => (
          <rect key={i} x="0" y={(i * 20) / 13} width="28" height={20 / 13} fill="#fff" />
        ))}
        <rect x="0" y="0" width="11.2" height={(20 * 7) / 13} fill="#3c3b6e" />
        {Array.from({ length: 20 }).map((_, i) => {
          const row = Math.floor(i / 5)
          const col = i % 5
          return (
            <circle
              key={i}
              cx={1.4 + col * 2.1}
              cy={1.2 + row * 2.3}
              r="0.42"
              fill="#fff"
            />
          )
        })}
      </g>
    </svg>
  )
}
