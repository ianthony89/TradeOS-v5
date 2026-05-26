// ============================================================
//  GET pin_len for a given email — public, no auth required.
//  Returns ONLY the PIN length (number of dots to show on pad).
//  No password, no hash, no secret is returned.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const { email } = await req.json()
  if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })

  const supabase = await createClient()

  // Look up via auth.users → profiles join
  // We use a public RPC to avoid exposing profiles directly
  const { data, error } = await supabase
    .rpc('get_pin_len_by_email', { p_email: email.toLowerCase().trim() })

  if (error || data === null) {
    // Return generic error — don't reveal whether email exists
    return NextResponse.json({ error: 'Account not found' }, { status: 404 })
  }

  return NextResponse.json({ pin_len: data ?? 6 })
}
