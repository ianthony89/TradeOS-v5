// ============================================================
//  TradeOS v5 — Quotes API Route
//  POST /api/quotes  { symbols: string[] }
//  Returns: Quote[] with live prices, updates holdings table
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient }  from '@/lib/supabase/server'
import { getQuotes }     from '@/lib/market/market-router'

export async function POST(req: NextRequest) {
  const supabase = await createClient()

  // ── Auth ──────────────────────────────────────────────────
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // ── Parse body ────────────────────────────────────────────
  const { symbols, skipCache } = await req.json() as {
    symbols:    string[]
    skipCache?: boolean
  }

  if (!Array.isArray(symbols) || !symbols.length)
    return NextResponse.json({ error: 'symbols array required' }, { status: 400 })

  // ── Fetch quotes via market router ────────────────────────
  const quotes = await getQuotes(symbols, { skipCache })

  // ── Patch holdings table with fresh prices ────────────────
  if (quotes.length) {
    const updates = quotes.map(q => ({
      symbol_normalized: q.symbol,
      current_price:     q.price,
      quotes_updated_at: q.timestamp,
    }))

    // Batch update — one call per quote to match on symbol_normalized
    await Promise.allSettled(
      updates.map(u =>
        supabase
          .from('holdings')
          .update({
            current_price:     u.current_price,
            quotes_updated_at: u.quotes_updated_at,
          })
          .eq('user_id', user.id)
          .eq('symbol_normalized', u.symbol_normalized)
      )
    )
  }

  return NextResponse.json({ quotes, count: quotes.length })
}

// ── GET /api/quotes?symbols=AAPL,5555.KL (convenience) ───────
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const raw     = req.nextUrl.searchParams.get('symbols') ?? ''
  const symbols = raw.split(',').map(s => s.trim()).filter(Boolean)

  if (!symbols.length)
    return NextResponse.json({ error: 'symbols param required' }, { status: 400 })

  const quotes = await getQuotes(symbols)
  return NextResponse.json({ quotes, count: quotes.length })
}
