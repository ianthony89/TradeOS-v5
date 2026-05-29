'use client'

import { fmt } from '@/lib/utils/format'
import { StockLogo } from '@/components/brand/stock-logo'

interface TickerStripItem {
  symbol:     string
  price:      number
  changePct:  number
  currency:   string
}

interface TickerStripProps {
  items:      TickerStripItem[]
  /** Scroll direction. 'left' (default) or 'right'. */
  direction?: 'left' | 'right'
  className?: string
}

/**
 * Premium horizontal market pulse strip.
 * Auto-scrolling marquee (pauses on hover). Items rendered twice
 * for a seamless wrap. Animation duration scales with item count.
 * Direction can be reversed for a dual-row (Apple Stocks) layout.
 */
export function TickerStrip({ items, direction = 'left', className = '' }: TickerStripProps) {
  if (!items.length) return null

  // Duration scales with item count so both rows share the same px/sec.
  // Tuned so the ~10-item Hot List row runs ≈55s (slightly faster pulse).
  const duration = Math.max(48, items.length * 5.5)

  return (
    <div className={`ticker-strip ${className}`}>
      <div
        className={`ticker-strip-track${direction === 'right' ? ' ticker-strip-track--right' : ''}`}
        style={{ ['--ticker-duration' as string]: `${duration}s` }}
      >
        {items.map(it => (
          <TickerChip key={`a-${it.symbol}`} {...it} />
        ))}
        {/* Duplicate the set so the loop is seamless */}
        {items.map(it => (
          <TickerChip key={`b-${it.symbol}`} {...it} />
        ))}
      </div>
    </div>
  )
}

function TickerChip({ symbol, price, changePct, currency }: TickerStripItem) {
  const tone  = changePct > 0 ? 'positive' : changePct < 0 ? 'negative' : 'neutral'
  const arrow = changePct > 0 ? '▲' : changePct < 0 ? '▼' : '·'
  return (
    <div className="ticker-chip">
      <StockLogo symbol={symbol} size={20} />
      <span className="ticker-chip-sym">{symbol}</span>
      <span className="ticker-chip-price text-mono text-tabular">{fmt.price(price)}</span>
      <span className={`ticker-chip-delta ticker-chip-delta--${tone} text-tabular`}>
        <span aria-hidden="true">{arrow}</span>
        <span>{fmt.pctSigned(changePct)}</span>
      </span>
      <span className="ticker-chip-cur">{currency}</span>
    </div>
  )
}
