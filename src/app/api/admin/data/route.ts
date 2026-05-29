// ============================================================
//  GET /api/admin/data
//  Admin-only. Returns invite codes + pending users + approved count.
// ============================================================

import { NextResponse } from 'next/server'
import { requireAdmin, adminClient } from '../_guard'

export async function GET() {
  const adminId = await requireAdmin()
  if (!adminId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const db = adminClient()

  const { data: codes } = await db
    .from('invite_codes')
    .select('id, code, used_at, created_at')
    .order('created_at', { ascending: false })
    .limit(50)

  const { data: profiles } = await db
    .from('profiles')
    .select('id, name, status, created_at')
    .order('created_at', { ascending: false })

  // Emails live in auth.users (admin API), not in profiles.
  const { data: { users } } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const emailById = new Map(users.map(u => [u.id, u.email ?? '']))

  const mapUser = (p: { id: string; name: string | null; created_at: string }) => ({
    id:        p.id,
    name:      p.name,
    email:     emailById.get(p.id) ?? '',
    createdAt: p.created_at,
  })

  const rows     = profiles ?? []
  const pending  = rows.filter(p => p.status === 'pending').map(mapUser)
  const approved = rows.filter(p => p.status === 'approved').map(mapUser)

  return NextResponse.json({
    codes:         codes ?? [],
    pending,
    approved,
    approvedCount: approved.length,
  })
}
