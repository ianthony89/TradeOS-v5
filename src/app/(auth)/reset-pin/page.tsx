'use client'

import { useState, useEffect } from 'react'
import { useRouter }    from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const PIN_LEN = 6

function validatePin(pin: string) {
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

  // Supabase sends the user here after clicking the email link.
  // The session is automatically picked up from the URL hash.
  useEffect(() => {
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true)
    })
  }, [])

  function pressDigit(d: number) {
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

  function pressBack() {
    setError('')
    if (pinPhase === 'confirm') {
      if (confirmPin.length === 0) { setPinPhase('set'); setPin(p => p.slice(0, -1)) }
      else setConfirmPin(p => p.slice(0, -1))
    } else {
      setPin(p => p.slice(0, -1))
    }
  }

  async function submitReset(newPin: string, confirm: string) {
    if (newPin !== confirm) {
      setError('PINs do not match')
      setConfirmPin('')
      setPinPhase('set')
      setPin('')
      return
    }
    const pinErr = validatePin(newPin)
    if (pinErr) { setError(pinErr); return }

    setLoading(true)
    try {
      // Update Supabase Auth password to new PIN (raw, Supabase bcrypts)
      const { error: updateErr } = await supabase.auth.updateUser({ password: newPin })
      if (updateErr) throw updateErr
      router.push('/dashboard')
    } catch (e: unknown) {
      setError((e as Error).message)
      setPin('')
      setConfirmPin('')
      setPinPhase('set')
    } finally {
      setLoading(false)
    }
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
        <div className="animate-spin w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[var(--accent)]">TradeOS</h1>
          <p className="text-[var(--muted)] mt-1 text-sm">
            {pinPhase === 'set' ? 'Set your new PIN' : 'Confirm your new PIN'}
          </p>
        </div>

        <div className="space-y-6">
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
      </div>
    </div>
  )
}
