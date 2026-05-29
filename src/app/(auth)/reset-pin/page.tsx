'use client'

import { useState, useEffect } from 'react'
import { useRouter }    from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Logo }         from '@/components/brand/logo'

const PIN_LEN = 6

function validatePin(pin: string): string | null {
  if (!/^\d+$/.test(pin)) return 'PIN must be digits only'
  if (pin.length < 4)     return 'PIN must be at least 4 digits'
  if (pin.length > 8)     return 'PIN must be at most 8 digits'
  return null
}

export default function ResetPinPage() {
  const router   = useRouter()
  const supabase = createClient()

  const [pin,        setPin]        = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [pinPhase,   setPinPhase]   = useState<'set' | 'confirm'>('set')
  const [error,      setError]      = useState('')
  const [loading,    setLoading]    = useState(false)
  const [ready,      setReady]      = useState(false)
  const [shake,      setShake]      = useState(false)

  const activePin = pinPhase === 'set' ? pin : confirmPin

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(event => {
      if (event === 'PASSWORD_RECOVERY') setReady(true)
    })
    return () => subscription.unsubscribe()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function submitReset(newPin: string, confirm: string) {
    if (newPin !== confirm) {
      setError('PINs do not match — try again')
      setPin('')
      setConfirmPin('')
      setPinPhase('set')
      setShake(true)
      setTimeout(() => setShake(false), 420)
      return
    }
    const pinErr = validatePin(newPin)
    if (pinErr) { setError(pinErr); return }

    setLoading(true)
    try {
      const { error: updateErr } = await supabase.auth.updateUser({ password: newPin })
      if (updateErr) throw updateErr
      router.push('/dashboard')
    } catch (e: unknown) {
      setError((e as Error).message)
      clearPin()
    } finally {
      setLoading(false)
    }
  }

  function appendDigit(d: number) {
    if (loading) return
    setError('')
    if (pinPhase === 'set') {
      if (pin.length >= PIN_LEN) return
      const next = pin + d
      setPin(next)
      if (next.length === PIN_LEN) setPinPhase('confirm')
    } else {
      if (confirmPin.length >= PIN_LEN) return
      const next = confirmPin + d
      setConfirmPin(next)
      if (next.length === PIN_LEN) setTimeout(() => submitReset(pin, next), 60)
    }
  }

  function removeDigit() {
    if (loading) return
    setError('')
    if (pinPhase === 'confirm') {
      if (confirmPin.length === 0) { setPinPhase('set'); setPin(p => p.slice(0, -1)) }
      else setConfirmPin(p => p.slice(0, -1))
    } else {
      setPin(p => p.slice(0, -1))
    }
  }

  function clearPin() {
    setPin('')
    setConfirmPin('')
    setPinPhase('set')
    setError('')
  }

  useEffect(() => {
    if (!ready) return
    function onKey(e: KeyboardEvent) {
      if (loading) return
      const k = e.key
      if (k >= '0' && k <= '9')                    appendDigit(parseInt(k, 10))
      else if (k === 'Backspace' || k === 'Delete') { e.preventDefault(); removeDigit() }
      else if (k === 'Escape')                      clearPin()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [ready, loading, pin, confirmPin, pinPhase]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!ready) {
    return (
      <div className="auth-screen">
        <div className="auth-card" style={{ textAlign: 'center', padding: '40px 32px' }}>
          <div className="auth-brand">
            <Logo size={40} glow className="auth-brand-mark" />
            <div className="auth-brand-name">TradeOS</div>
            <div className="auth-brand-meta">by Anthony · v5</div>
          </div>
          <div
            className="w-8 h-8 rounded-full border-2 animate-spin"
            style={{ borderColor: 'var(--border-strong)', borderTopColor: 'var(--accent)', margin: '0 auto' }}
          />
          <div className="text-tertiary" style={{ fontSize: 12.5, marginTop: 12 }}>
            Verifying reset link…
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">

        <div className="auth-brand">
          <Logo size={40} glow className="auth-brand-mark" />
          <div className="auth-brand-name">TradeOS</div>
          <div className="auth-brand-meta">by Anthony · v5</div>
        </div>

        <div className="pin-wrap">
          <div className="pin-header">
            <div className="pin-label">
              {pinPhase === 'set' ? 'Set your new PIN' : 'Confirm your new PIN'}
            </div>
            <div className="pin-hint">Keyboard: 0–9 · Backspace · Esc to clear</div>
          </div>

          <div className={`pin-dots${shake ? ' pin-dots--shake' : ''}`}>
            {Array.from({ length: PIN_LEN }).map((_, i) => (
              <div
                key={i}
                className={[
                  'pin-dot',
                  i < activePin.length
                    ? (error ? 'pin-dot--error' : 'pin-dot--filled')
                    : '',
                ].join(' ')}
              />
            ))}
          </div>

          <div className="pin-phase-bar">
            {(['set', 'confirm'] as const).map(phase => (
              <span
                key={phase}
                className={`pin-phase-dot${pinPhase === phase ? ' pin-phase-dot--active' : ''}`}
              />
            ))}
          </div>

          {error && <div className="auth-error">{error}</div>}

          <div className="pin-pad">
            {[1,2,3,4,5,6,7,8,9].map(d => (
              <button
                key={d}
                onClick={() => appendDigit(d)}
                disabled={loading}
                className="pin-key"
                type="button"
              >
                {d}
              </button>
            ))}
            <div />
            <button onClick={() => appendDigit(0)} disabled={loading} className="pin-key" type="button">0</button>
            <button onClick={removeDigit} disabled={loading} className="pin-key pin-key--muted" type="button">⌫</button>
          </div>

          <div className="pin-footer">
            <a href="/login" className="pin-text-link">← Back to sign in</a>
            <span className="text-tertiary" style={{ fontSize: 11.5 }}>Keyboard supported</span>
          </div>
        </div>
      </div>
    </div>
  )
}
