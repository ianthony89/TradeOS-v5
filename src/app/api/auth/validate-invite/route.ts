import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const { code } = await req.json()
  if (!code) return NextResponse.json({ error: 'Code required' }, { status: 400 })

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('invite_codes')
    .select('id, used_by, expires_at')
    .eq('code', code.trim().toUpperCase())
    .single()

  if (error || !data)
    return NextResponse.json({ error: 'Invalid invite code' }, { status: 400 })

  if (data.used_by)
    return NextResponse.json({ error: 'Invite code already used' }, { status: 400 })

  if (data.expires_at && new Date(data.expires_at) < new Date())
    return NextResponse.json({ error: 'Invite code has expired' }, { status: 400 })

  return NextResponse.json({ valid: true })
}
