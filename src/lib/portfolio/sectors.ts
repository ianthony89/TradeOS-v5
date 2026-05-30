// ============================================================
//  TradeOS v5 — Sector Classifier
//  Symbol → Sector mapping. Static, no API calls.
//  Falls back to asset-type heuristic, then 'Other'.
// ============================================================

const SECTOR_MAP: Record<string, string> = {
  // Mega-cap tech
  AAPL: 'Technology', MSFT: 'Technology', GOOG: 'Technology', GOOGL: 'Technology',
  META: 'Technology', NVDA: 'Technology', AMD: 'Technology', AVGO: 'Technology',
  CRM:  'Technology', ORCL: 'Technology', ADBE: 'Technology', IBM:  'Technology',
  INTC: 'Technology', MU:   'Technology', QCOM: 'Technology', TSM:  'Technology',
  ASML: 'Technology', ARM:  'Technology', SMCI: 'Technology', PLTR: 'Technology',
  SNOW: 'Technology', CRWD: 'Technology', NET:  'Technology', DDOG: 'Technology',
  NOK:  'Technology', AIXI: 'Technology', CETX: 'Technology',

  // Consumer Discretionary
  AMZN: 'Consumer Discretionary',  TSLA: 'Consumer Discretionary',  NKE:  'Consumer Discretionary',
  SBUX: 'Consumer Discretionary',  MCD:  'Consumer Discretionary',  CMG:  'Consumer Discretionary',
  HD:   'Consumer Discretionary',  LOW:  'Consumer Discretionary',  CTNT: 'Consumer Discretionary',
  AMZE: 'Consumer Discretionary',  SHOP: 'Consumer Discretionary',  UBER: 'Consumer Discretionary',
  ABNB: 'Consumer Discretionary',  LYFT: 'Consumer Discretionary',

  // Consumer Staples
  WMT: 'Consumer Staples', COST: 'Consumer Staples',
  KO:  'Consumer Staples', PEP:  'Consumer Staples', PG: 'Consumer Staples',
  MO:  'Consumer Staples',

  // Healthcare
  UNH:  'Healthcare', JNJ:   'Healthcare', LLY:   'Healthcare',
  ABBV: 'Healthcare', MRK:   'Healthcare', PFE:   'Healthcare',
  JUNS: 'Healthcare', IOBTQ: 'Healthcare',
  '5555': 'Healthcare',   // SUNMED (Bursa)

  // Financials
  JPM: 'Financials', BAC: 'Financials', WFC: 'Financials', GS: 'Financials',
  MS:  'Financials', V:   'Financials', MA:  'Financials', PYPL: 'Financials',
  COIN:'Financials', HOOD:'Financials', SOFI:'Financials',

  // Communication services
  NFLX: 'Communication Services', DIS: 'Communication Services',
  T:    'Communication Services', VZ:  'Communication Services',

  // Energy
  XOM:  'Energy', CVX:  'Energy',

  // Utilities
  CREG: 'Utilities',

  // ETF — broad market
  SPY:  'ETF',  VOO:  'ETF',  VTI:  'ETF',  VYM:  'ETF',  SCHD: 'ETF',
  QQQ:  'ETF',  DIA:  'ETF',
  // ETF — leveraged (still ETF sector, taxonomy handles strategy)
  SOXL: 'ETF',  TQQQ: 'ETF',  NVDL: 'ETF',
  CBRG: 'ETF',  CRCG: 'ETF',  FBL:  'ETF',  NOWL: 'ETF',

  // Crypto
  'BTC-USD': 'Crypto', 'ETH-USD': 'Crypto', 'SOL-USD': 'Crypto',
}

export function getSector(symbol: string, assetType?: string): string {
  const s = (symbol ?? '').toUpperCase().trim()
  if (SECTOR_MAP[s]) return SECTOR_MAP[s]
  const base = s.replace(/\.[A-Z]+$/, '')
  if (SECTOR_MAP[base]) return SECTOR_MAP[base]
  if (assetType === 'ETF')    return 'ETF'
  if (assetType === 'CRYPTO') return 'Crypto'
  if (assetType === 'INDEX')  return 'ETF'
  return 'Other'
}

/**
 * Return a CSS custom-property reference so colors swap with theme.
 * Sector tokens live in globals.css under :root and [data-theme="light"].
 */
const SECTOR_VAR: Record<string, string> = {
  'Technology':       'var(--sector-tech)',
  'Healthcare':       'var(--sector-healthcare)',
  'Financials':       'var(--sector-financials)',
  'Consumer Discretionary':   'var(--sector-consumer-disc)',
  'Consumer Staples': 'var(--sector-consumer-stap)',
  'Communication Services':   'var(--sector-comm)',
  'Energy':           'var(--sector-energy)',
  'Utilities':        'var(--sector-utilities)',
  'ETF':              'var(--sector-etf)',
  'Crypto':           'var(--sector-crypto)',
  'Other':            'var(--sector-other)',
}

export function getSectorColor(sector: string): string {
  return SECTOR_VAR[sector] ?? SECTOR_VAR['Other']
}
