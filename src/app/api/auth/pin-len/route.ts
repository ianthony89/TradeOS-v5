// ============================================================
//  POST /api/auth/pin-len
//  Returns ONLY the PIN length (dot count) for a given email.
//  No password, no hash, no secret returned.
//  Uses service-role admin client — server-side only.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Service-role admin client — bypasses RLS, never sent to browser
function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const email: string | undefined = body?.email
  if (!email) {
    return NextResponse.json({ error: 'Email required' }, { status: 400 })
  }

  const supabase = adminClient()
  const normalized = email.trim().toLowerCase()

  // ── Find user in auth.users by email (admin-only API) ─────
  // listUsers is paginated; invite-only system keeps user count small.
  const { data: { users }, error: listErr } = await supabase.auth.admin.listUsers({
    page: 1, perPage: 1000,
  })

  if (listErr) {
    return NextResponse.json({ error: 'Service error' }, { status: 500 })
  }

  const authUser = users.find(u => u.email?.toLowerCase() === normalized)
  if (!authUser) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 })
  }

  // ── Get pin_len from profiles (service role bypasses RLS) ─
  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('pin_len')
    .eq('id', authUser.id)
    .single()

  // If profile row missing or schema incomplete, fall back to default 6
  // (happens when migration hasn't been applied yet — column doesn't exist)
  if (profileErr || !profile) {
    return NextResponse.json({ pinLength: 6 })
  }

  return NextResponse.json({ pinLength: profile.pin_len ?? 6 })
}
