import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Called right after supabase.auth.signUp() succeeds.
// Marks the invite code as used (best-effort).
// Only requires `code` — email is not needed here.
export async function POST(req: NextRequest) {
  const { code } = await req.json()
  if (!code)
    return NextResponse.json({ error: 'Code required' }, { status: 400 })

  const supabase = await createClient()

  await supabase
    .from('invite_codes')
    .update({ used_at: new Date().toISOString() })
    .eq('code', code.trim().toUpperCase())
    .is('used_by', null)   // only consume once

  // Always return ok — registration already succeeded, invite marking is best-effort
  return NextResponse.json({ ok: true })
}
