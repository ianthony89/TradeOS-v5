'use client'

import { useState, useRef, useEffect } from 'react'
import { Lock, Radio } from 'lucide-react'
import { useMarketStore, selectActiveFxRate } from '@/stores/market'
import { useT } from '@/lib/i18n/context'
import { fmt } from '@/lib/utils/format'

/**
 * USD/MYR pill with click-to-edit popover.
 *
 *   - Shows the active rate + MANUAL/LIVE badge
 *   - Click → inline popover to edit the manual rate
 *   - Enter to save, Esc to cancel, click outside to dismiss
 *
 * Per AGENTS.md § 6: FX is a reference tool, not auto-magic.
 * The popover makes editing instant — no detour to Settings needed.
 */
export function FxPill({ className = '' }: { className?: string }) {
  const t = useT()
  const fxMode      = useMarketStore(s => s.fxMode)
  const activeRate  = useMarketStore(selectActiveFxRate)
  const manualRate  = useMarketStore(s => s.fxManualRate)
  const setManual   = useMarketStore(s => s.setFxManualRate)

  const isLiveMode  = fxMode === 'live'

  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const wrapRef  = useRef<HTMLSpanElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function openEditor() {
    setDraft(fmt.fxRate(manualRate))
    setOpen(true)
    setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }, 30)
  }

  function commit() {
    const v = parseFloat(draft)
    if (Number.isFinite(v) && v > 0 && v < 100) {
      setManual(v)
    }
    setOpen(false)
  }

  function cancel() {
    setOpen(false)
  }

  /* Click outside + Escape */
  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) cancel()
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') cancel()
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const title = isLiveMode ? t('fx_title_live') : t('fx_title_manual')

  return (
    <span ref={wrapRef} className={`fx-pill-wrap ${className}`}>
      <button
        type="button"
        className="market-pill fx-pill"
        onClick={openEditor}
        title={title}
      >
        <span className="fx-pill-eq">
          1 USD = <b className="text-mono text-tabular">{fmt.fxRate(activeRate)}</b> MYR
        </span>
        <span
          className="fx-pill-tag"
          data-mode={isLiveMode ? 'live' : 'manual'}
          aria-label={title}
        >
          {isLiveMode ? <Radio size={12} /> : <Lock size={12} />}
        </span>
      </button>

      {open && (
        <div className="fx-popover" role="dialog" aria-label={t('fx_pop_label')}>
          <div className="fx-popover-label">{t('fx_pop_label')}</div>
          <div className="fx-popover-row">
            <input
              ref={inputRef}
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.1"
              max="20"
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') commit()
                else if (e.key === 'Escape') cancel()
              }}
              className="input text-mono text-tabular fx-popover-input"
            />
            <button type="button" onClick={commit} className="btn btn-primary btn-sm">
              {t('fx_save')}
            </button>
          </div>
          {isLiveMode && (
            <div className="fx-popover-hint">
              {t('fx_live_hint')}
            </div>
          )}
        </div>
      )}
    </span>
  )
}
