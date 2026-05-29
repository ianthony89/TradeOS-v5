'use client'

import { useState } from 'react'
import {
  parqetLogoUrl,
  logoInitials,
  avatarGradient,
} from '@/lib/market/logo-chain'

interface StockLogoProps {
  symbol:     string
  size?:      number     // 20 | 24 | 28 | 32 | 40
  className?: string
}

/**
 * Stock logo with two-tier resolution:
 *   1. Parqet public CDN (US equities, ETFs, crypto pairs)
 *   2. Deterministic gradient letter avatar (everything else)
 *
 * When the CDN returns 404, the <img> errors and is hidden via state.
 * No live API key required. Safe for Bursa Malaysia and other non-US tickers.
 */
export function StockLogo({ symbol, size = 28, className = '' }: StockLogoProps) {
  const url      = parqetLogoUrl(symbol)
  const initials = logoInitials(symbol)
  const gradient = avatarGradient(symbol)
  const [imgFailed, setImgFailed] = useState(false)

  const fontSize = size <= 24 ? 9.5 : size <= 32 ? 10.5 : 12

  return (
    <span
      className={`stock-logo ${className}`}
      style={{
        width:    size,
        height:   size,
        fontSize,
        background: gradient,
      }}
    >
      <span className="stock-logo-avatar" aria-hidden="true">
        {initials}
      </span>
      {url && !imgFailed && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt=""
          loading="lazy"
          className="stock-logo-img"
          onError={() => setImgFailed(true)}
        />
      )}
    </span>
  )
}

/**
 * Two-line "symbol + name" cell.
 * Used in holdings table, watchlist, search results, etc.
 */
interface SymCellProps {
  symbol:    string
  name?:     string | null
  currency?: string
  logoSize?: number
  className?: string
}

export function SymCell({ symbol, name, currency, logoSize = 32, className = '' }: SymCellProps) {
  return (
    <span className={`sym-cell ${className}`}>
      <StockLogo symbol={symbol} size={logoSize} />
      <span className="sym-cell-text">
        <span className="sym-cell-ticker">{symbol}</span>
        {(name || currency) && (
          <span className="sym-cell-name">
            {name || ''}{name && currency ? ' · ' : ''}{currency || ''}
          </span>
        )}
      </span>
    </span>
  )
}
