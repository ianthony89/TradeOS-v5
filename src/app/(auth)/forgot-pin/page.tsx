'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function ForgotPinPage() {
  const supabase = createClient()
  const [email,   setEmail]   = useState('')
  const [sent,    setSent]    = useState(false)
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-pin`,
      })
      if (resetErr) throw resetErr
      setSent(true)
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[var(--accent)]">TradeOS</h1>
          <p className="text-[var(--muted)] mt-1 text-sm">Reset your PIN</p>
        </div>

        {sent ? (
          <div className="text-center space-y-4">
            <div className="text-4xl">📧</div>
            <p className="text-[var(--fg)]">Check your email</p>
            <p className="text-sm text-[var(--muted)]">
              We sent a reset link to <strong>{email}</strong>.<br />
              Click the link to set a new PIN.
            </p>
            <a href="/login" className="btn btn-ghost btn-sm inline-flex">
              Back to sign in
            </a>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm mb-1 text-[var(--fg)]">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                className="input w-full" placeholder="you@example.com" required />
            </div>
            {error && <p className="text-[var(--negative)] text-sm">{error}</p>}
            <button type="submit" disabled={loading} className="btn btn-primary w-full">
              {loading ? 'Sending…' : 'Send reset link'}
            </button>
            <p className="text-center">
              <a href="/login" className="text-sm text-[var(--muted)] hover:text-[var(--accent)]">
                ← Back to sign in
              </a>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
