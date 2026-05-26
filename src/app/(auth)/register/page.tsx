'use client'

import { useState } from 'react'
import { useRouter }    from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

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

  // ── PIN pad ───────────────────────────────────────────────
  function pressDigit(d: number) {
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
    setError('')
  }

  function pressBack() {
    setError('')
    if (pinPhase === 'confirm') {
      if (confirmPin.length === 0) { setPinPhase('set'); setPin(p => p.slice(0, -1)) }
      else setConfirmPin(p => p.slice(0, -1))
    } else {
      setPin(p => p.slice(0, -1))
    }
  }

  // ── Step 1: validate info + invite code ───────────────────
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

  // ── Step 2: register — PIN is the Supabase password, raw ─
  async function submitRegistration(finalPin: string, finalConfirm: string) {
    if (finalPin !== finalConfirm) {
      setError('PINs do not match')
      setConfirmPin('')
      setPinPhase('set')
      setPin('')
      return
    }
    const { valid, error: pinErr } = validatePin(finalPin)
    if (!valid) { setError(pinErr ?? 'Invalid PIN'); return }

    setLoading(true)
    setError('')
    try {
      const { error: signUpErr } = await supabase.auth.signUp({
        email,
        password: finalPin,   // raw PIN → Supabase bcrypts it
        options: {
          data: {
            name,
            pin_len:  PIN_LEN,
            status:   'pending',    // requires admin approval
          },
        },
      })
      if (signUpErr) throw signUpErr

      // Mark invite code as used
      await fetch('/api/auth/use-invite', {
        method:  'POST',
        headers: { 'content-type': 'application/json' },
        body:    JSON.stringify({ code: inviteCode }),
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

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[var(--accent)]">TradeOS</h1>
          <p className="text-[var(--muted)] mt-1 text-sm">Create your account</p>
        </div>

        {step === 'info' && (
          <form onSubmit={handleInfoSubmit} className="space-y-4">
            <div>
              <label className="block text-sm mb-1 text-[var(--fg)]">Your Name</label>
              <input value={name} onChange={e => setName(e.target.value)}
                className="input w-full" placeholder="Alex" required />
            </div>
            <div>
              <label className="block text-sm mb-1 text-[var(--fg)]">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                className="input w-full" placeholder="you@example.com" required />
            </div>
            <div>
              <label className="block text-sm mb-1 text-[var(--fg)]">Invite Code</label>
              <input value={inviteCode} onChange={e => setInviteCode(e.target.value.toUpperCase())}
                className="input w-full font-mono tracking-wider" placeholder="XXXX-XXXX" required />
            </div>
            {error && <p className="text-[var(--negative)] text-sm">{error}</p>}
            <button type="submit" disabled={loading} className="btn btn-primary w-full">
              {loading ? 'Checking…' : 'Continue'}
            </button>
            <p className="text-center text-sm text-[var(--muted)]">
              Already have an account?{' '}
              <a href="/login" className="text-[var(--accent)] hover:underline">Sign in</a>
            </p>
          </form>
        )}

        {step === 'pin' && (
          <div className="space-y-6">
            <p className="text-center text-sm text-[var(--muted)]">
              {pinPhase === 'set'
                ? `Set a ${PIN_LEN}-digit PIN`
                : 'Confirm your PIN'}
            </p>

            {/* PIN dots */}
            <div className="flex justify-center gap-3">
              {Array.from({ length: PIN_LEN }).map((_, i) => {
                const active = pinPhase === 'set' ? pin : confirmPin
                return (
                  <div key={i} className={`w-4 h-4 rounded-full border-2 transition-all duration-150
                    ${i < active.length
                      ? 'bg-[var(--accent)] border-[var(--accent)] scale-110'
                      : 'border-[var(--border)]'}`}
                  />
                )
              })}
            </div>

            {error && <p className="text-[var(--negative)] text-sm text-center">{error}</p>}

            <div className="grid grid-cols-3 gap-3">
              {[1,2,3,4,5,6,7,8,9].map(d => (
                <button key={d} onClick={() => pressDigit(d)} disabled={loading} className="pin-key">{d}</button>
              ))}
              <div />
              <button onClick={() => pressDigit(0)} disabled={loading} className="pin-key">0</button>
              <button onClick={pressBack} disabled={loading} className="pin-key text-[var(--muted)]">⌫</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
