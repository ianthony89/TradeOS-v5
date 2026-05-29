// ============================================================
//  POST /api/auth/validate-invite
//  Validates an invite code during registration.
//
//  Uses the service-role admin client (server-side only) because the
//  caller is NOT authenticated yet at registration time — and RLS on
//  invite_codes only permits reads for authenticated users. Without
//  the admin client every code would falsely read as "invalid".
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Service-role admin client — bypasses RLS, never sent to the browser.
function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const code: string | undefined = body?.code
  if (!code) return NextResponse.json({ error: 'Code required' }, { status: 400 })

  const supabase = adminClient()

  const { data, error } = await supabase
    .from('invite_codes')
    .select('id, used_at, expires_at')
    .eq('code', code.trim().toUpperCase())
    .maybeSingle()

  if (error || !data)
    return NextResponse.json({ error: 'Invalid invite code' }, { status: 400 })

  // used_at is the authoritative "consumed" marker (set by use-invite).
  if (data.used_at)
    return NextResponse.json({ error: 'Invite code already used' }, { status: 400 })

  if (data.expires_at && new Date(data.expires_at) < new Date())
    return NextResponse.json({ error: 'Invite code has expired' }, { status: 400 })

  return NextResponse.json({ valid: true })
}
