'use client'

import { useState } from 'react'
import { useRouter }    from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { hashPin, validatePin } from '@/lib/auth/pin'

const PIN_LEN = 6

export default function RegisterPage() {
  const router   = useRouter()
  const supabase = createClient()

  const [step,        setStep]        = useState<'info' | 'pin' | 'confirm'>('info')
  const [name,        setName]        = useState('')
  const [email,       setEmail]       = useState('')
  const [inviteCode,  setInviteCode]  = useState('')
  const [pin,         setPin]         = useState('')
  const [confirmPin,  setConfirmPin]  = useState('')
  const [activePin,   setActivePin]   = useState<'pin' | 'confirm'>('pin')
  const [error,       setError]       = useState('')
  const [loading,     setLoading]     = useState(false)

  function pressDigit(d: number) {
    if (activePin === 'pin') {
      if (pin.length >= PIN_LEN) return
      const next = pin + d
      setPin(next)
      if (next.length === PIN_LEN) setActivePin('confirm')
    } else {
      if (confirmPin.length >= PIN_LEN) return
      setConfirmPin(p => p + d)
    }
    setError('')
  }

  function pressBack() {
    if (activePin === 'confirm' && confirmPin.length === 0) {
      setActivePin('pin')
      setPin(p => p.slice(0, -1))
    } else if (activePin === 'confirm') {
      setConfirmPin(p => p.slice(0, -1))
    } else {
      setPin(p => p.slice(0, -1))
    }
    setError('')
  }

  async function handleInfoSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!name.trim()) { setError('Please enter your name'); return }
    if (!inviteCode.trim()) { setError('Invite code required'); return }

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

  async function handleRegister() {
    if (pin !== confirmPin) { setError('PINs do not match'); setConfirmPin(''); return }
    const { valid, error: pinErr } = validatePin(pin)
    if (!valid) { setError(pinErr ?? 'Invalid PIN'); return }

    setLoading(true)
    setError('')
    try {
      const pin_hash = await hashPin(pin)

      const { error: signUpErr } = await supabase.auth.signUp({
        email,
        password: pin,   // password = PIN
        options: {
          data: { name, pin_hash, pin_len: PIN_LEN },
        },
      })
      if (signUpErr) throw signUpErr

      // Mark invite code as used
      await fetch('/api/auth/use-invite', {
        method:  'POST',
        headers: { 'content-type': 'application/json' },
        body:    JSON.stringify({ code: inviteCode, email }),
      })

      router.push('/dashboard')
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  // Auto-submit when confirmPin is full
  if (confirmPin.length === PIN_LEN && !loading && !error) {
    setTimeout(handleRegister, 60)
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
              <input value={inviteCode} onChange={e => setInviteCode(e.target.value)}
                className="input w-full" placeholder="XXXX-XXXX" required />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
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
              {activePin === 'pin' ? `Set your ${PIN_LEN}-digit PIN` : 'Confirm your PIN'}
            </p>

            {/* PIN dots */}
            <div className="flex justify-center gap-3">
              {Array.from({ length: PIN_LEN }).map((_, i) => {
                const filled = activePin === 'pin' ? i < pin.length : i < confirmPin.length
                return (
                  <div key={i} className={`w-4 h-4 rounded-full border-2 transition-all duration-150
                    ${filled ? 'bg-[var(--accent)] border-[var(--accent)] scale-110' : 'border-[var(--border)]'}`}
                  />
                )
              })}
            </div>

            {error && <p className="text-red-400 text-sm text-center">{error}</p>}

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
