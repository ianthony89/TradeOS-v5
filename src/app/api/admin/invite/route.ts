// ============================================================
//  POST /api/admin/invite
//  Admin-only. Generates a fresh single-use invite code.
// ============================================================

import { NextResponse } from 'next/server'
import { requireAdmin, adminClient } from '../_guard'

// Readable code, no ambiguous chars (0/O/1/I/L excluded).
function genCode(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  const block = (n: number) =>
    Array.from({ length: n }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('')
  return `TOS-${block(4)}-${block(4)}`
}

export async function POST() {
  try {
    const adminId = await requireAdmin()
    if (!adminId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const db = adminClient()

    for (let attempt = 0; attempt < 5; attempt++) {
      const code = genCode()
      const { data, error } = await db
        .from('invite_codes')
        .insert({ code })
        .select('id, code, used_at, created_at')
        .single()

      if (!error && data) return NextResponse.json({ code: data })
      if (error?.code === '23505') continue   // unique collision — retry

      if (error) {
        console.error('[admin/invite] insert error:', error)
        return NextResponse.json(
          { error: 'Could not create code', detail: error.message, code: error.code, hint: error.hint },
          { status: 500 },
        )
      }
    }
    return NextResponse.json({ error: 'Could not create code (collisions)' }, { status: 500 })
  } catch (e) {
    console.error('[admin/invite] threw:', e)
    return NextResponse.json({ error: 'Server error', detail: (e as Error).message }, { status: 500 })
  }
}
