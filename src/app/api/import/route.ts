// ============================================================
//  TradeOS v5 — CSV Import API Route
//  POST /api/import
//  Body: FormData with file: File (CSV)
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseMoomooCSV } from '@/lib/utils/csv-parser'
import { detectAssetType } from '@/lib/market/asset-type'

export async function POST(req: NextRequest) {
  const supabase = await createClient()

  // ── Auth check ────────────────────────────────────────────
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // ── Parse multipart form ──────────────────────────────────
  const form = await req.formData()
  const file = form.get('file') as File | null
  if (!file)
    return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })

  const csvText = await file.text()

  // ── Parse CSV ─────────────────────────────────────────────
  const { holdings, broker, errors, rowCount } = parseMoomooCSV(csvText)

  if (!holdings.length)
    return NextResponse.json({ error: 'No valid holdings found', details: errors }, { status: 422 })

  // ── Create import session ─────────────────────────────────
  const { data: session, error: sessionErr } = await supabase
    .from('import_sessions')
    .insert({
      user_id:      user.id,
      broker,
      symbol_count: holdings.length,
    })
    .select('id')
    .single()

  if (sessionErr || !session) {
    console.error('[import] session insert failed:', sessionErr)
    return NextResponse.json(
      { error: 'Failed to create import session', details: sessionErr?.message },
      { status: 500 },
    )
  }

  // ── Upsert holdings ───────────────────────────────────────
  const rows = holdings.map(h => ({
    user_id:           user.id,
    symbol:            h.symbol,
    symbol_normalized: h.symbolNormalized,
    name:              h.name,
    quantity:          h.quantity,
    available_qty:     h.availableQty,
    avg_cost:          h.avgCost,
    current_price:     h.currentPrice,
    market_value:      h.marketValue,
    unrealized_pl:     h.unrealizedPl,
    unrealized_pl_pct: h.unrealizedPlPct,
    realized_pl:       h.realizedPl,
    today_pl:          h.todayPl,
    today_turnover:    h.todayTurnover,
    currency:          h.currency,
    asset_type:        detectAssetType(h.symbolNormalized),
    last_import_id:    session.id,
    updated_at:        new Date().toISOString(),
  }))

  const { error: upsertErr } = await supabase
    .from('holdings')
    .upsert(rows, { onConflict: 'user_id,symbol_normalized' })

  if (upsertErr) {
    console.error('[import] holdings upsert failed:', upsertErr)
    return NextResponse.json(
      { error: 'Failed to save holdings', details: upsertErr.message, code: upsertErr.code, hint: upsertErr.hint },
      { status: 500 },
    )
  }

  // ── CSV is the source of truth: close positions absent from it ─
  // Any currently-open holding NOT in this CSV is zeroed out (closed in
  // place) — quantity / value / live P&L → 0, but symbol / name / avg cost /
  // realized P&L are KEPT for the Closed-positions view. Nothing is deleted,
  // so position_intelligence + journal_entries (symbol-keyed) survive intact.
  let closedCount = 0
  const presentSet = new Set(holdings.map(h => h.symbolNormalized))
  const { data: existing } = await supabase
    .from('holdings')
    .select('id, symbol_normalized, quantity')
    .eq('user_id', user.id)

  const toClose = (existing ?? []).filter(
    e => Number(e.quantity) > 0 && !presentSet.has(e.symbol_normalized),
  )
  if (toClose.length) {
    const { error: closeErr } = await supabase
      .from('holdings')
      .update({
        quantity:          0,
        available_qty:     0,
        market_value:      0,
        unrealized_pl:     0,
        unrealized_pl_pct: 0,
        today_pl:          0,
        last_import_id:    session.id,
        updated_at:        new Date().toISOString(),
      })
      .in('id', toClose.map(e => e.id))

    if (closeErr) {
      // Non-fatal: the import itself succeeded; closing stale rows is best-effort.
      console.error('[import] close-absent failed:', closeErr)
    } else {
      closedCount = toClose.length
    }
  }

  // ── Calculate total values for snapshot ──────────────────
  let totalUsd = 0, totalMyr = 0
  for (const h of holdings) {
    if (h.currency === 'MYR') totalMyr += h.marketValue
    else                      totalUsd += h.marketValue
  }

  // ── Save portfolio snapshot (for history chart) ───────────
  await supabase.from('portfolio_snapshots').insert({
    user_id:   user.id,
    total_usd: totalUsd,
    total_myr: totalMyr,
    import_id: session.id,
  })

  // ── Update import session with totals ─────────────────────
  await supabase
    .from('import_sessions')
    .update({ total_value_usd: totalUsd, total_value_myr: totalMyr })
    .eq('id', session.id)

  return NextResponse.json({
    ok:           true,
    imported:     holdings.length,
    closed:       closedCount,
    sessionId:    session.id,
    totalUsd,
    totalMyr,
    warnings:     errors,
    rowsParsed:   rowCount,
  })
}
