'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter }   from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { verifyPin }    from '@/lib/auth/pin'

const PIN_DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0]

export default function LoginPage() {
  const router  = useRouter()
  const supabase = createClient()

  const [step,    setStep]    = useState<'email' | 'pin'>('email')
  const [email,   setEmail]   = useState('')
  const [pin,     setPin]     = useState('')
  const [pinLen,  setPinLen]  = useState(6)
  const [pinHash, setPinHash] = useState('')
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)
  const emailRef = useRef<HTMLInputElement>(null)

  useEffect(() => { emailRef.current?.focus() }, [])

  // ── Step 1: Look up account by email ──────────────────────
  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      // Sign in with magic link first to get session, then we verify PIN
      // Strategy: use email+password where password = pin_hash
      // We first fetch the profile to know pin_len
      const { data, error: signInErr } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false },
      })
      if (signInErr) throw signInErr

      // Fetch profile pin info via a server action / API call
      const res  = await fetch('/api/auth/profile-pin', {
        method:  'POST',
        headers: { 'content-type': 'application/json' },
        body:    JSON.stringify({ email }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Account not found')

      setPinLen(json.pin_len)
      setPinHash(json.pin_hash)
      setStep('pin')
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  // ── Step 2: PIN entry ─────────────────────────────────────
  function pressDigit(d: number) {
    if (pin.length >= pinLen) return
    const next = pin + d
    setPin(next)
    if (next.length === pinLen) setTimeout(() => handlePinSubmit(next), 60)
  }

  function pressBack() {
    setPin(p => p.slice(0, -1))
    setError('')
  }

  async function handlePinSubmit(enteredPin: string) {
    setError('')
    setLoading(true)
    try {
      const ok = await verifyPin(enteredPin, pinHash)
      if (!ok) {
        setPin('')
        setError('Incorrect PIN')
        setLoading(false)
        return
      }
      // PIN correct — complete sign-in via email OTP session
      // The OTP was triggered above; now sign in properly
      const { error: pwErr } = await supabase.auth.signInWithPassword({
        email,
        password: enteredPin,   // password = PIN (set during registration)
      })
      if (pwErr) throw pwErr
      router.push('/dashboard')
    } catch (e: unknown) {
      setError((e as Error).message)
      setPin('')
    } finally {
      setLoading(false)
    }
  }

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[var(--accent)]">TradeOS</h1>
          <p className="text-[var(--muted)] mt-1 text-sm">
            {step === 'email' ? 'Sign in to your account' : `Welcome back — enter your ${pinLen}-digit PIN`}
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
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full"
            >
              {loading ? 'Looking up…' : 'Continue'}
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

            {error && <p className="text-red-400 text-sm text-center">{error}</p>}

            {/* PIN pad */}
            <div className="grid grid-cols-3 gap-3">
              {[1,2,3,4,5,6,7,8,9].map(d => (
                <button
                  key={d}
                  onClick={() => pressDigit(d)}
                  disabled={loading}
                  className="pin-key"
                >
                  {d}
                </button>
              ))}
              <div /> {/* empty */}
              <button onClick={() => pressDigit(0)} disabled={loading} className="pin-key">0</button>
              <button onClick={pressBack} disabled={loading} className="pin-key text-[var(--muted)]">⌫</button>
            </div>

            <button
              onClick={() => { setStep('email'); setPin(''); setError('') }}
              className="w-full text-sm text-[var(--muted)] hover:text-[var(--fg)]"
            >
              ← Use different account
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
