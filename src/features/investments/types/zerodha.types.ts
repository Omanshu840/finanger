// Raw row as PapaParse delivers it (dynamicTyping: true)
export interface ZerodhaHoldingsRow {
  // Core fields — present in all Zerodha holdings exports
  'Instrument'?:      string    // Kite CSV uses "Instrument"
  'Symbol'?:          string    // Console CSV uses "Symbol"
  'ISIN'?:            string
  'Quantity'?:        number | string
  'Avg. cost'?:       number | string   // Kite label
  'Average Cost'?:    number | string   // Console label
  'Average Price'?:   number | string   // alternate label
  'LTP'?:             number | string   // Last Traded Price (optional — present in some exports)
  'Type'?:            string
  'P&L'?:             number | string
  'Net Change'?:      number | string

  // Allow any extra columns we don't know about
  [key: string]: unknown
}

// What the parser guarantees after validation
export interface ZerodhaHolding {
  symbol:   string     // e.g. "INFY"
  isin:     string     // e.g. "INE009A01021"
  quantity: number     // integer > 0
  avgCost:  number     // per-share cost, may be 0 if column absent
  ltp?:     number     // last traded price — optional
  type:     'stock' | 'mf'
}

export interface ZerodhaParseResult {
  holdings:      ZerodhaHolding[]
  skipped:       number              // rows that failed validation
  skippedReasons: string[]           // diagnostic messages (dev mode)
}
