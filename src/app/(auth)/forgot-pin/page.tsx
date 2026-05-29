'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Logo }         from '@/components/brand/logo'

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
    <div className="auth-screen">
      <div className="auth-card">

        <div className="auth-brand">
          <Logo size={40} glow className="auth-brand-mark" />
          <div className="auth-brand-name">TradeOS</div>
          <div className="auth-brand-meta">by Anthony · v5</div>
        </div>

        {sent ? (
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="empty-state-icon" style={{ margin: '0 auto' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                <polyline points="22,6 12,13 2,6"/>
              </svg>
            </div>
            <div>
              <div className="auth-brand-name" style={{ fontSize: 16 }}>Check your email</div>
              <div className="text-tertiary" style={{ fontSize: 12.5, marginTop: 4, lineHeight: 1.6 }}>
                Reset link sent to <span className="text-secondary text-mono">{email}</span>
              </div>
            </div>
            <a href="/login" className="btn btn-ghost" style={{ alignSelf: 'center' }}>← Back to sign in</a>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="auth-form">
            <div className="auth-field">
              <label className="auth-label">Email address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="input"
                placeholder="you@example.com"
                autoFocus
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
              {loading ? <span className="auth-spinner" /> : 'Send reset link'}
            </button>

            <div className="auth-footer">
              <a href="/login" className="auth-link">← Back to sign in</a>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
