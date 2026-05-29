// ============================================================
//  POST /api/admin/approve   { userId }
//  Admin-only. Flips a pending user's status to 'approved'.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, adminClient } from '../_guard'

export async function POST(req: NextRequest) {
  const adminId = await requireAdmin()
  if (!adminId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => null)
  const userId: string | undefined = body?.userId
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

  const db = adminClient()
  const { error } = await db.from('profiles').update({ status: 'approved' }).eq('id', userId)
  if (error) return NextResponse.json({ error: 'Could not approve' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
