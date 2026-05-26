'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter }    from 'next/navigation'

export default function PendingApprovalPage() {
  const router   = useRouter()
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] p-4">
      <div className="w-full max-w-sm text-center space-y-6">
        <div className="text-5xl">⏳</div>
        <div>
          <h1 className="text-xl font-semibold text-[var(--fg)]">Pending Approval</h1>
          <p className="text-[var(--muted)] text-sm mt-2">
            Your account is awaiting admin approval.<br />
            You'll be notified once access is granted.
          </p>
        </div>
        <button onClick={handleSignOut} className="btn btn-ghost btn-sm">
          Sign out
        </button>
      </div>
    </div>
  )
}
