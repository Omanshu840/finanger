export type AssetType = 'stock' | 'mf' | 'bank' | 'fd' | 'esop' | 'cash'

export interface Asset {
  id: string
  type: AssetType
  name: string
  quantity?: number       // stocks, MFs, FDs
  value?: number          // manual value (bank, cash, esop) or calculated current value
  buyPrice?: number       // cost per unit (stock/MF) — for P/L calculation
  symbol?: string         // stock ticker: "INFY.NS"
  isin: string            // ISIN — for stocks (Zerodha import) and MFs (AMFI NAV lookup)
  lastUpdated?: number    // unix ms — set after price refresh
  schemeCode?:  string    // AMFI scheme code — legacy, can be used if ISIN unavailable
  lastNAV?:     number    // most recently resolved NAV — for display in AssetCard
}

export interface Snapshot {
  id: string
  timestamp: number       // unix ms
  netWorth: number
  breakdown: Record<AssetType, number>  // { stock: 120000, mf: 80000, ... }
}