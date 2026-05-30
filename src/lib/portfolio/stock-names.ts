// ============================================================
//  TradeOS v5 — Stock Name Localization
//  Symbol → { en, zh } display name. Falls back to the broker
//  CSV name when a symbol isn't mapped. Extend as needed.
// ============================================================

export const STOCK_NAMES: Record<string, { en: string; zh: string }> = {
  // Mega-cap US
  AAPL:  { en: 'Apple',           zh: '苹果' },
  MSFT:  { en: 'Microsoft',       zh: '微软' },
  NVDA:  { en: 'NVIDIA',          zh: '英伟达' },
  AMZN:  { en: 'Amazon',          zh: '亚马逊' },
  GOOGL: { en: 'Alphabet',        zh: '谷歌' },
  GOOG:  { en: 'Alphabet',        zh: '谷歌' },
  META:  { en: 'Meta',            zh: 'Meta' },
  TSLA:  { en: 'Tesla',           zh: '特斯拉' },
  AMD:   { en: 'AMD',             zh: 'AMD' },
  NFLX:  { en: 'Netflix',         zh: '奈飞' },
  INTC:  { en: 'Intel',           zh: '英特尔' },

  // Broad ETFs
  SPY:   { en: 'S&P 500 ETF',     zh: '标普500 ETF' },
  QQQ:   { en: 'Nasdaq-100 ETF',  zh: '纳指100 ETF' },
  DIA:   { en: 'Dow Jones ETF',   zh: '道指 ETF' },

  // Anthony's holdings
  NOK:   { en: 'Nokia',                    zh: '诺基亚' },
  AIXI:  { en: 'Xiao-I',                   zh: '小i机器人' },
  CETX:  { en: 'Cemtrex',                  zh: 'Cemtrex' },
  CTNT:  { en: 'Cheetah Net Supply Chain', zh: '猎豹网络' },
  IOBTQ: { en: 'IO Biotech',               zh: 'IO Biotech' },
  CREG:  { en: 'China Recycling Energy',   zh: '中国循环能源' },
  JUNS:  { en: 'Jupiter Neurosciences',    zh: 'Jupiter 神经科学' },
  FBL:   { en: 'GraniteShares 2x Long META', zh: '2倍做多META ETF' },
  CRCG:  { en: 'GraniteShares 2x Long CRCL', zh: '2倍做多CRCL ETF' },
  NOWL:  { en: 'GraniteShares 2x Long NOW',  zh: '2倍做多NOW ETF' },
  CBRG:  { en: 'GraniteShares 2x Long CRWV', zh: '2倍做多CRWV ETF' },
  AMZE:  { en: 'Amaze Holdings',           zh: 'Amaze Holdings' },
  '5555':{ en: 'SUNMED',                   zh: 'SUNMED' },
}

/** Localized display name for a symbol; falls back to `fallback` (CSV name). */
export function stockName(symbol: string, fallback: string | null, lang: 'en' | 'zh'): string {
  const base = (symbol ?? '').toUpperCase().replace(/\.[A-Z]+$/, '')
  const m = STOCK_NAMES[base] ?? STOCK_NAMES[(symbol ?? '').toUpperCase()]
  if (m) return lang === 'zh' ? m.zh : m.en
  return fallback ?? symbol
}
