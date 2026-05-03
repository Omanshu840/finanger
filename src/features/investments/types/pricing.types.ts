// ── Output types (what the app consumes) ────────────────────────────────────

export interface StockQuote {
  symbol:            string
  price:             number     // regularMarketPrice
  previousClose:     number     // regularMarketPreviousClose
  change:            number     // absolute change
  changePercent:     number     // % change
  currency:          string     // "INR"
  marketState:       'REGULAR' | 'PRE' | 'POST' | 'CLOSED' | 'PREPRE' | 'POSTPOST'
  shortName:         string
  fetchedAt:         number     // unix ms
}

/** symbol → StockQuote */
export type PriceMap = Record<string, StockQuote>

/** symbol → error message (for failed fetches) */
export type PriceErrorMap = Record<string, string>

export interface FetchPricesResult {
  prices: PriceMap
  errors: PriceErrorMap   // symbols that failed
}

// ── Yahoo Proxy response types ──────────────────────────────────────────────

export interface YahooProxyItem {
  symbol:        string
  price:         number
  previousClose: number
  change:        number
  changePercent: number    // in percent (1.5 = 1.5%), not fraction
  currency:      string
  marketState:   string    // e.g. "UNKNOWN", "REGULAR", "CLOSED"
}

export interface YahooProxyResponse {
  data: YahooProxyItem[]
}

export interface AMFIEntry {
  schemeCode:  string    // e.g. "119551"
  isin:        string    // e.g. "INF846K01EH3"
  name:        string    // full name as published by AMFI
  nav:         number    // parsed float
  date:        string    // "2026-04-29" (ISO format)
}

/** Proxy API response for ISIN lookup */
export interface AMFIProxyResponse {
  data: AMFIEntry[]
}

/** Primary output: schemeCode → NAV */
export type NavMap = Record<string, number>

/** Extended map: schemeCode → full entry (for name-based search) */
export type NavEntryMap = Record<string, AMFIEntry>

export interface FetchAMFIResult {
  navMap:       NavMap        // schemeCode → nav (fast lookup)
  entryMap:     NavEntryMap   // schemeCode → AMFIEntry (name search / display)
  asOf:         string        // date from entries
}