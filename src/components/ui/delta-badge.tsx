import { fmt } from '@/lib/utils/format'

interface DeltaBadgeProps {
  /** Percent value, e.g. 1.79 for +1.79%. */
  value:    number | null | undefined
  /** Use compact pill style instead of inline text. */
  variant?: 'pill' | 'inline'
  /** Always show + on positive. */
  signed?:  boolean
  className?: string
}

/**
 * P/L delta indicator with ▲ / ▼ arrow.
 * Color-coded — positive (emerald), negative (rose), neutral (mute).
 */
export function DeltaBadge({
  value,
  variant = 'pill',
  signed = true,
  className = '',
}: DeltaBadgeProps) {
  const v = value ?? 0
  const tone =
    v > 0 ? 'positive' :
    v < 0 ? 'negative' : 'neutral'
  const arrow =
    v > 0 ? '▲' :
    v < 0 ? '▼' : '·'

  const label = signed ? fmt.pctSigned(v) : fmt.pct(v)

  if (variant === 'inline') {
    return (
      <span className={`delta delta-${tone} ${className}`}>
        <span aria-hidden="true">{arrow}</span>
        <span>{label}</span>
      </span>
    )
  }

  return (
    <span className={`delta-badge delta-badge--${tone} ${className}`}>
      <span aria-hidden="true">{arrow}</span>
      <span>{label}</span>
    </span>
  )
}

interface DeltaMoneyProps {
  value:    number | null | undefined
  currency?: string
  variant?: 'pill' | 'inline'
  className?: string
}

/** Same as DeltaBadge but displays signed money instead of percent. */
export function DeltaMoney({
  value,
  currency = 'USD',
  variant = 'inline',
  className = '',
}: DeltaMoneyProps) {
  const v = value ?? 0
  const tone =
    v > 0 ? 'positive' :
    v < 0 ? 'negative' : 'neutral'
  const arrow =
    v > 0 ? '▲' :
    v < 0 ? '▼' : '·'

  const label = fmt.moneySigned(v, currency)

  if (variant === 'pill') {
    return (
      <span className={`delta-badge delta-badge--${tone} ${className}`}>
        <span aria-hidden="true">{arrow}</span>
        <span>{label}</span>
      </span>
    )
  }
  return (
    <span className={`delta delta-${tone} ${className}`}>
      <span aria-hidden="true">{arrow}</span>
      <span>{label}</span>
    </span>
  )
}
