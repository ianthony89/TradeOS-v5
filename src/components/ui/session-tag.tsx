'use client'

import { useT } from '@/lib/i18n/context'
import { fmt } from '@/lib/utils/format'
import type { QuoteSession, SessionMove } from '@/lib/market/quote-session'

const TONE: Record<QuoteSession, string> = {
  REGULAR:         'live',
  PRE_MARKET:      'pre',
  POST_MARKET:     'post',
  OVERNIGHT_CLOSE: 'close',
}
const LABEL_KEY: Record<QuoteSession, string> = {
  REGULAR:         'sess_live',
  PRE_MARKET:      'sess_pre',
  POST_MARKET:     'sess_post',
  OVERNIGHT_CLOSE: 'sess_close',
}

/** Session badge: LIVE / PRE / POST / LAST CLOSE. Display-only. */
export function SessionTag({ session, className = '' }: { session: QuoteSession; className?: string }) {
  const t = useT()
  return (
    <span className={`session-tag session-tag--${TONE[session]} ${className}`}>
      {t(LABEL_KEY[session])}
    </span>
  )
}

/**
 * Extended-hours move badge: "PRE +2.14" / "POST -1.80".
 * A SEPARATE element from Today's P&L — never replaces it.
 */
export function SessionMoveTag({ data }: { data: SessionMove }) {
  const t = useT()
  const up    = data.move >= 0
  const tone  = data.session === 'PRE_MARKET' ? 'pre' : 'post'
  const label = data.session === 'PRE_MARKET' ? t('sess_pre') : t('sess_post')
  const sign  = up ? '+' : '−'   // minus sign U+2212
  return (
    <span
      className={`session-move session-move--${up ? 'up' : 'down'}`}
      title={`${label} ${sign}${fmt.pct(Math.abs(data.movePct), 2)}`}
    >
      <span className={`session-tag session-tag--${tone}`}>{label}</span>
      <span className="session-move-val text-mono text-tabular">{sign}{fmt.price(Math.abs(data.move))}</span>
    </span>
  )
}
