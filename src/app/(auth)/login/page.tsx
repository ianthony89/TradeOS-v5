'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter }    from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const DEFAULT_PIN_LEN = 6

export default function LoginPage() {
  const router   = useRouter()
  const supabase = createClient()

  const [step,    setStep]    = useState<'email' | 'pin'>('email')
  const [email,   setEmail]   = useState('')
  const [pinLen,  setPinLen]  = useState(DEFAULT_PIN_LEN)
  const [pin,     setPin]     = useState('')
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)
  const emailRef = useRef<HTMLInputElement>(null)

  useEffect(() => { emailRef.current?.focus() }, [])

  // ── Step 1: validate email exists, get pin length ─────────
  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      // Fetch pin_len from public profile lookup (length only, no secret)
      const res  = await fetch('/api/auth/pin-len', {
        method:  'POST',
        headers: { 'content-type': 'application/json' },
        body:    JSON.stringify({ email }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Account not found')
      setPinLen(json.pin_len ?? DEFAULT_PIN_LEN)
      setStep('pin')
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  // ── Step 2: PIN digits ────────────────────────────────────
  function pressDigit(d: number) {
    if (pin.length >= pinLen) return
    const next = pin + d
    setPin(next)
    if (next.length === pinLen) setTimeout(() => submitPin(next), 60)
  }

  function pressBack() {
    setPin(p => p.slice(0, -1))
    setError('')
  }

  // ── Step 3: sign in — PIN is the password, raw, no hashing
  async function submitPin(enteredPin: string) {
    setError('')
    setLoading(true)
    try {
      const { error: authErr } = await supabase.auth.signInWithPassword({
        email,
        password: enteredPin,   // raw PIN → Supabase bcrypts internally
      })
      if (authErr) throw authErr

      // Check approval status
      const { data: profile } = await supabase
        .from('profiles')
        .select('status')
        .eq('email_ref', email)
        .single()

      if (profile?.status === 'pending') {
        router.push('/pending-approval')
        return
      }
      if (profile?.status === 'suspended') {
        throw new Error('Account suspended. Contact admin.')
      }

      router.push('/dashboard')
    } catch (e: unknown) {
      setError((e as Error).message === 'Invalid login credentials'
        ? 'Incorrect PIN'
        : (e as Error).message)
      setPin('')
    } finally {
      setLoading(false)
    }
  }

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[var(--accent)]">TradeOS</h1>
          <p className="text-[var(--muted)] mt-1 text-sm">
            {step === 'email' ? 'Sign in to your account' : `Enter your ${pinLen}-digit PIN`}
          </p>
        </div>

        {step === 'email' ? (
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            <div>
              <label className="block text-sm mb-1 text-[var(--fg)]">Email</label>
              <input
                ref={emailRef}
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="input w-full"
                placeholder="you@example.com"
                required
              />
            </div>
            {error && <p className="text-[var(--negative)] text-sm">{error}</p>}
            <button type="submit" disabled={loading} className="btn btn-primary w-full">
              {loading ? 'Checking…' : 'Continue'}
            </button>
            <p className="text-center text-sm text-[var(--muted)]">
              Need an account?{' '}
              <a href="/register" className="text-[var(--accent)] hover:underline">Register</a>
            </p>
          </form>
        ) : (
          <div className="space-y-6">
            {/* PIN dots */}
            <div className="flex justify-center gap-3">
              {Array.from({ length: pinLen }).map((_, i) => (
                <div
                  key={i}
                  className={`w-4 h-4 rounded-full border-2 transition-all duration-150
                    ${i < pin.length
                      ? 'bg-[var(--accent)] border-[var(--accent)] scale-110'
                      : 'border-[var(--border)]'
                    }`}
                />
              ))}
            </div>

            {error && <p className="text-[var(--negative)] text-sm text-center">{error}</p>}

            {/* PIN pad */}
            <div className="grid grid-cols-3 gap-3">
              {[1,2,3,4,5,6,7,8,9].map(d => (
                <button key={d} onClick={() => pressDigit(d)} disabled={loading} className="pin-key">
                  {d}
                </button>
              ))}
              <div />
              <button onClick={() => pressDigit(0)} disabled={loading} className="pin-key">0</button>
              <button onClick={pressBack} disabled={loading} className="pin-key text-[var(--muted)]">⌫</button>
            </div>

            <div className="flex justify-between text-sm">
              <button
                onClick={() => { setStep('email'); setPin(''); setError('') }}
                className="text-[var(--muted)] hover:text-[var(--fg)]"
              >
                ← Back
              </button>
              <a href="/forgot-pin" className="text-[var(--muted)] hover:text-[var(--accent)]">
                Forgot PIN?
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
