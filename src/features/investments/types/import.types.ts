import type { Asset } from '@/features/investments/types/asset.types'
import type { ZerodhaHolding } from '@/features/investments/types/zerodha.types'

// ── Unified holding type for XLSX import (both equity and MF) ────────────────
export interface Holding {
  symbol:   string        // e.g. "INFY" or "AXIS MIDCAP FUND - DIRECT PLAN"
  isin:     string        // e.g. "INE009A01021"
  quantity: number        // integer > 0 (can be fractional for MF)
  avgCost:  number        // per-unit cost, may be 0 if not available
  type:     'equity' | 'mf'
}

export interface HoldingsParseResult {
  holdings:        Holding[]
  skipped:         number
  skippedReasons:  string[]
  meta: {
    fileName:     string
    fileSize:     number
    totalRows:    number
  }
}

export type ConflictResolution = 'merge' | 'skip' | 'replace'

export interface ImportConflict {
  incoming:   ZerodhaHolding
  existing:   Asset
  resolution: ConflictResolution   // default: 'merge'
}

export interface ImportPreviewRow {
  holding:    ZerodhaHolding
  conflict:   ImportConflict | null  // null = new asset, no conflict
}

export interface ImportSummary {
  added:    number
  merged:   number
  replaced: number
  skipped:  number
}