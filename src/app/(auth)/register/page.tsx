'use client'

import { useState, useEffect } from 'react'
import { useRouter }    from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Logo }         from '@/components/brand/logo'

const PIN_LEN = 6

function validatePin(pin: string): { valid: boolean; error?: string } {
  if (!/^\d+$/.test(pin)) return { valid: false, error: 'PIN must be digits only' }
  if (pin.length < 4)     return { valid: false, error: 'PIN must be at least 4 digits' }
  if (pin.length > 8)     return { valid: false, error: 'PIN must be at most 8 digits' }
  return { valid: true }
}

export default function RegisterPage() {
  const router   = useRouter()
  const supabase = createClient()

  const [step,       setStep]       = useState<'info' | 'pin'>('info')
  const [name,       setName]       = useState('')
  const [email,      setEmail]      = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [pin,        setPin]        = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [pinPhase,   setPinPhase]   = useState<'set' | 'confirm'>('set')
  const [error,      setError]      = useState('')
  const [loading,    setLoading]    = useState(false)
  const [shake,      setShake]      = useState(false)

  const activePin = pinPhase === 'set' ? pin : confirmPin

  async function submitRegistration(finalPin: string, finalConfirm: string) {
    if (finalPin !== finalConfirm) {
      setError('PINs do not match — try again')
      setPin('')
      setConfirmPin('')
      setPinPhase('set')
      setShake(true)
      setTimeout(() => setShake(false), 420)
      return
    }
    const { valid, error: pinErr } = validatePin(finalPin)
    if (!valid) { setError(pinErr ?? 'Invalid PIN'); return }

    setLoading(true)
    setError('')
    try {
      const { error: signUpErr } = await supabase.auth.signUp({
        email,
        password: finalPin,
        options: { data: { name, pin_len: PIN_LEN, status: 'pending' } },
      })
      if (signUpErr) throw signUpErr

      await fetch('/api/auth/use-invite', {
        method:  'POST',
        headers: { 'content-type': 'application/json' },
        body:    JSON.stringify({ code: inviteCode, email }),
      })

      router.push('/pending-approval')
    } catch (e: unknown) {
      setError((e as Error).message)
      setPin('')
      setConfirmPin('')
      setPinPhase('set')
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
      if (next.length === PIN_LEN) setTimeout(() => submitRegistration(pin, next), 60)
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
    if (step !== 'pin') return
    function onKey(e: KeyboardEvent) {
      if (loading) return
      const k = e.key
      if (k >= '0' && k <= '9')                    appendDigit(parseInt(k, 10))
      else if (k === 'Backspace' || k === 'Delete') { e.preventDefault(); removeDigit() }
      else if (k === 'Escape')                      clearPin()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [step, loading, pin, confirmPin, pinPhase]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleInfoSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!name.trim()) { setError('Please enter your name'); return }
    setLoading(true)
    try {
      const res  = await fetch('/api/auth/validate-invite', {
        method:  'POST',
        headers: { 'content-type': 'application/json' },
        body:    JSON.stringify({ code: inviteCode }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Invalid invite code')
      setStep('pin')
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">

        <div className="auth-brand">
          <Logo size={40} glow className="auth-brand-mark" />
          <div className="auth-brand-name">TradeOS</div>
          <div className="auth-brand-meta">by Anthony · v5</div>
        </div>

        {step === 'info' ? (
          <form onSubmit={handleInfoSubmit} className="auth-form">
            <div className="auth-field">
              <label className="auth-label">Your name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="input"
                placeholder="Alex"
                autoFocus
                required
              />
            </div>
            <div className="auth-field">
              <label className="auth-label">Email address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="input"
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </div>
            <div className="auth-field">
              <label className="auth-label">Invite code</label>
              <input
                value={inviteCode}
                onChange={e => setInviteCode(e.target.value.toUpperCase())}
                className="input text-mono"
                placeholder="XXXX-XXXX"
                style={{ letterSpacing: '0.2em' }}
                required
              />
            </div>

            {error && <div className="auth-error">{error}</div>}

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{ height: 44, width: '100%', marginTop: 4 }}
            >
              {loading ? <span className="auth-spinner" /> : 'Continue →'}
            </button>

            <div className="auth-footer">
              Already have an account? <a href="/login" className="auth-link">Sign in</a>
            </div>
          </form>
        ) : (
          <div className="pin-wrap">
            <div className="pin-header">
              <div className="pin-label">
                {pinPhase === 'set' ? `Set a ${PIN_LEN}-digit PIN` : 'Confirm your PIN'}
              </div>
              <div className="pin-hint">
                {pinPhase === 'set'
                  ? 'Choose a PIN you will remember'
                  : 'Enter the same PIN again'}
              </div>
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
              <button onClick={() => { setStep('info'); clearPin() }} className="pin-text-link" type="button">
                ← Back
              </button>
              <span className="text-tertiary" style={{ fontSize: 11.5 }}>Keyboard supported</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
