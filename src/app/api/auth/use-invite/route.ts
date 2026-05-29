// ============================================================
//  POST /api/auth/use-invite   { code, email? }
//  Called right after supabase.auth.signUp() succeeds.
//  Consumes the invite code so it can't be reused (single-use).
//
//  Uses the service-role client: invite_codes has no UPDATE RLS policy,
//  so a normal/session client cannot mark a code used. setting used_at
//  is what validate-invite checks to reject reuse.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const code:  string | undefined = body?.code
  const email: string | undefined = body?.email
  if (!code) return NextResponse.json({ error: 'Code required' }, { status: 400 })

  const db = adminClient()

  // Best-effort: resolve the registrant's id so we can record who used it.
  let usedBy: string | null = null
  if (email) {
    const { data: { users } } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 })
    usedBy = users.find(u => u.email?.toLowerCase() === email.trim().toLowerCase())?.id ?? null
  }

  // Consume once: only flip a code that hasn't been used yet.
  await db
    .from('invite_codes')
    .update({ used_at: new Date().toISOString(), used_by: usedBy })
    .eq('code', code.trim().toUpperCase())
    .is('used_at', null)

  // Registration already succeeded — code consumption is best-effort.
  return NextResponse.json({ ok: true })
}
