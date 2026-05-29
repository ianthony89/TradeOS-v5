'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter }    from 'next/navigation'
import { Logo }         from '@/components/brand/logo'

export default function PendingApprovalPage() {
  const router   = useRouter()
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="auth-screen">
      <div className="auth-card" style={{ textAlign: 'center' }}>

        <div className="auth-brand">
          <Logo size={40} glow className="auth-brand-mark" />
          <div className="auth-brand-name">TradeOS</div>
          <div className="auth-brand-meta">by Anthony · v5</div>
        </div>

        <div className="empty-state-icon" style={{ margin: '0 auto 14px' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </div>

        <div className="auth-brand-name" style={{ fontSize: 16, marginBottom: 6 }}>
          Awaiting approval
        </div>
        <div className="text-tertiary" style={{ fontSize: 12.5, lineHeight: 1.6, marginBottom: 20 }}>
          Your account has been created.<br />
          You&apos;ll get access once an admin approves it.
        </div>

        <button onClick={handleSignOut} className="btn btn-ghost btn-sm">
          Sign out
        </button>
      </div>
    </div>
  )
}
