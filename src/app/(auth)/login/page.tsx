'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter }    from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Logo }         from '@/components/brand/logo'

const DEFAULT_PIN_LEN     = 6
const STORAGE_EMAIL_KEY   = 'tradeos:last_email'
const STORAGE_PIN_LEN_KEY = 'tradeos:last_pin_len'

export default function LoginPage() {
  const router   = useRouter()
  const supabase = createClient()

  const [step,      setStep]      = useState<'email' | 'pin'>('email')
  const [email,     setEmail]     = useState('')
  const [pinLen,    setPinLen]    = useState(DEFAULT_PIN_LEN)
  const [pin,       setPin]       = useState('')
  const [error,     setError]     = useState('')
  const [loading,   setLoading]   = useState(false)
  const [shake,     setShake]     = useState(false)
  const [fromCache, setFromCache] = useState(false)
  const emailRef = useRef<HTMLInputElement>(null)

  /* Hydrate cached email → skip email step.
     setState in effect is intentional here: we read localStorage which is
     only available client-side after hydration. */
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      const cachedEmail  = localStorage.getItem(STORAGE_EMAIL_KEY)
      const cachedPinLen = localStorage.getItem(STORAGE_PIN_LEN_KEY)
      if (cachedEmail && cachedPinLen) {
        setEmail(cachedEmail)
        setPinLen(parseInt(cachedPinLen, 10) || DEFAULT_PIN_LEN)
        setFromCache(true)
        setStep('pin')
        return
      }
    } catch { /* private mode — fall through */ }
    emailRef.current?.focus()
  }, [])
  /* eslint-enable react-hooks/set-state-in-effect */

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res  = await fetch('/api/auth/pin-len', {
        method:  'POST',
        headers: { 'content-type': 'application/json' },
        body:    JSON.stringify({ email }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Account not found')
      setPinLen(json.pinLength ?? DEFAULT_PIN_LEN)
      setStep('pin')
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  function appendDigit(d: number) {
    if (loading) return
    setPin(prev => {
      if (prev.length >= pinLen) return prev
      const next = prev + d
      if (next.length === pinLen) setTimeout(() => submitPin(next), 60)
      return next
    })
  }

  function removeDigit() {
    if (loading) return
    setPin(p => p.slice(0, -1))
    setError('')
  }

  function clearPin() {
    setPin('')
    setError('')
  }

  function useDifferentAccount() {
    try {
      localStorage.removeItem(STORAGE_EMAIL_KEY)
      localStorage.removeItem(STORAGE_PIN_LEN_KEY)
    } catch { /* ignore */ }
    setFromCache(false)
    setStep('email')
    setEmail('')
    setPin('')
    setPinLen(DEFAULT_PIN_LEN)
    setError('')
    setTimeout(() => emailRef.current?.focus(), 50)
  }

  /* Keyboard support */
  useEffect(() => {
    if (step !== 'pin') return
    function onKey(e: KeyboardEvent) {
      if (loading) return
      const k = e.key
      if (k >= '0' && k <= '9') {
        appendDigit(parseInt(k, 10))
      } else if (k === 'Backspace' || k === 'Delete') {
        e.preventDefault()
        removeDigit()
      } else if (k === 'Escape') {
        clearPin()
      } else if (k === 'Enter') {
        setPin(p => {
          if (p.length === pinLen) setTimeout(() => submitPin(p), 0)
          return p
        })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [step, loading, pinLen]) // eslint-disable-line react-hooks/exhaustive-deps

  async function submitPin(enteredPin: string) {
    setError('')
    setLoading(true)
    try {
      const { error: authErr } = await supabase.auth.signInWithPassword({
        email,
        password: enteredPin,
      })
      if (authErr) throw authErr

      const { data: { user: authedUser } } = await supabase.auth.getUser()
      const { data: profile } = await supabase
        .from('profiles')
        .select('status')
        .eq('id', authedUser!.id)
        .single()

      try {
        localStorage.setItem(STORAGE_EMAIL_KEY,   email)
        localStorage.setItem(STORAGE_PIN_LEN_KEY, String(pinLen))
      } catch { /* ignore */ }

      if (profile?.status === 'pending')   { router.push('/pending-approval'); return }
      if (profile?.status === 'suspended') throw new Error('Account suspended. Contact admin.')
      router.push('/dashboard')
    } catch (e: unknown) {
      const msg = (e as Error).message === 'Invalid login credentials'
        ? 'Incorrect PIN'
        : (e as Error).message
      setError(msg)
      setPin('')
      setShake(true)
      setTimeout(() => setShake(false), 420)
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

        {step === 'email' ? (
          <form onSubmit={handleEmailSubmit} className="auth-form">
            <div className="auth-field">
              <label className="auth-label" htmlFor="login-email">Email address</label>
              <input
                ref={emailRef}
                id="login-email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="input"
                placeholder="you@example.com"
                autoComplete="email"
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
              Need an account? <a href="/register" className="auth-link">Request access</a>
            </div>
          </form>
        ) : (
          <div className="pin-wrap">
            <div className="pin-header">
              <div className="pin-label">Enter your {pinLen}-digit PIN</div>
              <div className="pin-hint">Keyboard: 0–9 · Backspace · Enter · Esc to clear</div>
            </div>

            <div className={`pin-dots${shake ? ' pin-dots--shake' : ''}`}>
              {Array.from({ length: pinLen }).map((_, i) => (
                <div
                  key={i}
                  className={[
                    'pin-dot',
                    i < pin.length
                      ? (error ? 'pin-dot--error' : 'pin-dot--filled')
                      : '',
                  ].join(' ')}
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
              {fromCache ? (
                <div className="pin-cached">
                  <span className="pin-cached-email">{email}</span>
                  <button onClick={useDifferentAccount} type="button" className="pin-text-link">
                    Use different account
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => { setStep('email'); setPin(''); setError('') }}
                  type="button"
                  className="pin-text-link"
                >
                  ← Back
                </button>
              )}
              <a href="/forgot-pin" className="auth-link">Forgot PIN?</a>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
