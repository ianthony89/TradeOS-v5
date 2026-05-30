'use client'

import { useState, useRef, useEffect } from 'react'
import { useMarketStore, selectActiveFxRate } from '@/stores/market'
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
  const fxMode      = useMarketStore(s => s.fxMode)
  const liveRate    = useMarketStore(s => s.fxLiveRate)
  const updatedAt   = useMarketStore(s => s.fxUpdatedAt)
  const activeRate  = useMarketStore(selectActiveFxRate)
  const manualRate  = useMarketStore(s => s.fxManualRate)
  const setManual   = useMarketStore(s => s.setFxManualRate)

  const isLiveMode  = fxMode === 'live'
  const hasLiveData = isLiveMode && liveRate > 0

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

  const title =
    hasLiveData ? `Live · updated ${fmt.relativeTime(updatedAt)} · click to edit fallback` :
    isLiveMode  ? 'Live mode — awaiting first fetch · click to edit fallback'             :
                  'Manual rate — click to edit'

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
        <span className="fx-pill-tag" data-mode={isLiveMode ? 'live' : 'manual'}>
          <span className="fx-pill-dot" />
          {isLiveMode ? 'live' : 'manual'}
        </span>
      </button>

      {open && (
        <div className="fx-popover" role="dialog" aria-label="Edit FX rate">
          <div className="fx-popover-label">Manual rate · USD / MYR</div>
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
              Save
            </button>
          </div>
          {isLiveMode && (
            <div className="fx-popover-hint">
              Live mode active — manual rate is fallback only
            </div>
          )}
        </div>
      )}
    </span>
  )
}
