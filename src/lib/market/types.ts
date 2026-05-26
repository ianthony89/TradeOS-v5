// ============================================================
//  TradeOS v5 — Market Data Types
// ============================================================

export interface Quote {
  symbol:               string
  regularMarketPrice:   number        // last official close, always present
  price:                number        // best current price (pre/regular/post)
  preMarketPrice?:      number
  postMarketPrice?:     number
  change:               number
  changePercent:        number
  currency:             string
  marketState:          'REGULAR' | 'PRE' | 'POST' | 'CLOSED' | 'PREPRE' | 'POSTPOST'
  volume?:              number
  marketCap?:           number
  fiftyTwoWeekHigh?:    number
  fiftyTwoWeekLow?:     number
  timestamp:            string        // ISO8601, JSON-safe
  source:               'yahoo' | 'finnhub' | 'cache'
  assetType?:           AssetType
}

export interface Candle {
  time:    string    // ISO8601 date
  open:    number
  high:    number
  low:     number
  close:   number
  volume:  number
}

export interface NewsItem {
  id:        string
  headline:  string
  summary?:  string
  source:    string
  url:       string
  image?:    string
  datetime:  string    // ISO8601
  related:   string[]  // related symbols
}

export interface MarketDataProvider {
  getQuote(symbol: string): Promise<Quote>
  getQuotes(symbols: string[]): Promise<Quote[]>
  getHistorical(symbol: string, from: Date, to: Date): Promise<Candle[]>
  getNews(symbol: string): Promise<NewsItem[]>
}

export type AssetType =
  | 'US_EQUITY'
  | 'MY_EQUITY'
  | 'ETF'
  | 'INDEX'
  | 'CRYPTO'
  | 'UNKNOWN'

export interface RouterOptions {
  skipCache?: boolean
}
