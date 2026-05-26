import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const { code, email } = await req.json()
  if (!code || !email)
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const supabase = await createClient()

  // Mark invite code as used (best-effort, no auth required at this point)
  await supabase
    .from('invite_codes')
    .update({ used_at: new Date().toISOString() })
    .eq('code', code.trim().toUpperCase())
    .is('used_by', null)

  return NextResponse.json({ ok: true })
}
