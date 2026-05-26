// ============================================================
//  TradeOS v5 — Moomoo CSV Parser
//  Auto-detects EN/ZH headers, normalizes to internal schema
// ============================================================

import Papa from 'papaparse'
import { normalizeSymbol } from '@/lib/market/symbol-normalizer'

export interface RawHolding {
  symbol:           string
  symbolNormalized: string
  name:             string
  quantity:         number
  availableQty:     number
  avgCost:          number
  currentPrice:     number
  marketValue:      number
  unrealizedPl:     number
  unrealizedPlPct:  number
  totalPl:          number
  realizedPl:       number
  todayPl:          number
  todayTurnover:    number
  todayBuyAvg:      number | null
  todaySellAvg:     number | null
  portfolioWeight:  number
  currency:         string
}

export interface ParseResult {
  holdings:  RawHolding[]
  broker:    string
  errors:    string[]
  rowCount:  number
}

// ── Header maps (EN + ZH) ─────────────────────────────────────
const HEADER_MAP: Record<string, keyof RawHolding | '__skip'> = {
  // English headers (Moomoo EN export)
  'symbol':                    'symbol',
  'name':                      'name',
  'quantity':                  'quantity',
  'available qty':             'availableQty',
  'current price':             'currentPrice',
  'average cost':              'avgCost',
  'market value':              'marketValue',
  '% unrealized p/l':         'unrealizedPlPct',
  'total p/l':                 'totalPl',
  'unrealized p/l':            'unrealizedPl',
  'realized p/l':              'realizedPl',
  "today's p/l":               'todayPl',
  '% of portfolio':            'portfolioWeight',
  'currency':                  'currency',
  "today's turnover":          'todayTurnover',
  "today's purchase@avg price":'todayBuyAvg',
  "today's sales@avg price":   'todaySellAvg',

  // Chinese headers (Moomoo ZH export)
  '代码':   'symbol',
  '名称':   'name',
  '持有数量': 'quantity',
  '可用数量': 'availableQty',
  '现价':   'currentPrice',
  '平均成本价': 'avgCost',
  '市值':   'marketValue',
  '未实现盈亏比例': 'unrealizedPlPct',
  '总盈亏金额': 'totalPl',
  '未实现盈亏': 'unrealizedPl',
  '已实现盈亏': 'realizedPl',
  '今日盈亏': 'todayPl',
  '持仓占比': 'portfolioWeight',
  '币种':   'currency',
  '今日成交额': 'todayTurnover',
  '今日买入@均价': 'todayBuyAvg',
  '今日卖出@均价': 'todaySellAvg',
}

// ── Number parser (handles "1,234.56", "-18.00", "+2.91", "--") ──
function parseNum(raw: string | undefined): number {
  if (!raw || raw.trim() === '--' || raw.trim() === '') return 0
  // Remove commas, +/% signs
  const cleaned = raw.replace(/,/g, '').replace('%', '').trim()
  const n = parseFloat(cleaned)
  return isNaN(n) ? 0 : n
}

// ── Main parser ───────────────────────────────────────────────
export function parseMoomooCSV(csvText: string): ParseResult {
  const errors: string[]    = []
  const holdings: RawHolding[] = []

  const result = Papa.parse<Record<string, string>>(csvText, {
    header:         true,
    skipEmptyLines: true,
    transformHeader: (h: string) => h.trim().replace(/^"/, '').replace(/"$/, ''),
  })

  if (result.errors.length) {
    result.errors.forEach(e => errors.push(`Row ${e.row}: ${e.message}`))
  }

  const rows = result.data
  if (!rows.length) {
    return { holdings: [], broker: 'moomoo', errors: ['CSV is empty'], rowCount: 0 }
  }

  // Map headers → internal field names
  const rawHeaders = Object.keys(rows[0])
  const colMap: Record<string, keyof RawHolding | '__skip'> = {}
  for (const h of rawHeaders) {
    const mapped = HEADER_MAP[h.toLowerCase().trim()]
    if (mapped) colMap[h] = mapped
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]

    // Build normalized object
    const mapped: Partial<Record<keyof RawHolding, string>> = {}
    for (const [col, field] of Object.entries(colMap)) {
      if (field !== '__skip') mapped[field] = row[col] ?? ''
    }

    const symbol   = (mapped.symbol ?? '').trim().replace(/^"/, '').replace(/"$/, '')
    const currency = (mapped.currency ?? 'USD').trim().toUpperCase()

    if (!symbol) { errors.push(`Row ${i + 2}: missing symbol, skipped`); continue }

    // Normalize symbol using currency field (CTO spec)
    let symbolNormalized: string
    try {
      symbolNormalized = normalizeSymbol(symbol, currency)
    } catch (e) {
      errors.push(`Row ${i + 2}: ${(e as Error).message}`)
      symbolNormalized = symbol   // use raw as fallback
    }

    holdings.push({
      symbol,
      symbolNormalized,
      name:            (mapped.name ?? '').trim(),
      quantity:         parseNum(mapped.quantity),
      availableQty:     parseNum(mapped.availableQty),
      avgCost:          parseNum(mapped.avgCost),
      currentPrice:     parseNum(mapped.currentPrice),
      marketValue:      parseNum(mapped.marketValue),
      unrealizedPl:     parseNum(mapped.unrealizedPl),
      unrealizedPlPct:  parseNum(mapped.unrealizedPlPct),
      totalPl:          parseNum(mapped.totalPl),
      realizedPl:       parseNum(mapped.realizedPl),
      todayPl:          parseNum(mapped.todayPl),
      todayTurnover:    parseNum(mapped.todayTurnover),
      todayBuyAvg:      mapped.todayBuyAvg && mapped.todayBuyAvg !== '--'
                          ? parseFloat(mapped.todayBuyAvg.split('@')[1] ?? '0') || null
                          : null,
      todaySellAvg:     mapped.todaySellAvg && mapped.todaySellAvg !== '--'
                          ? parseFloat(mapped.todaySellAvg.split('@')[1] ?? '0') || null
                          : null,
      portfolioWeight:  parseNum(mapped.portfolioWeight),
      currency,
    })
  }

  return { holdings, broker: 'moomoo', errors, rowCount: rows.length }
}
