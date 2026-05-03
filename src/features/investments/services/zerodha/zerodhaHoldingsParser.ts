import type { CSVRow } from '@/features/investments/types/csv.types'
import type {
  ZerodhaHoldingsRow,
  ZerodhaHolding,
  ZerodhaParseResult,
} from '@/features/investments/types/zerodha.types'

// ── Column name aliases ───────────────────────────────────────────────────────
// Zerodha has shipped at least 3 different column name sets across Kite / Console / SOH.
// We resolve each logical field from a priority-ordered list of candidate names.

const SYMBOL_COLS   = ['Instrument', 'Symbol', 'Stock Symbol', 'Tradingsymbol'] as const
const ISIN_COLS     = ['ISIN'] as const
const QUANTITY_COLS = ['Quantity', 'Qty', 'Current Balance', 'Qty.'] as const
const AVGCOST_COLS  = ['Avg. cost', 'Average Cost', 'Average Price', 'Avg Cost', 'Avg Price'] as const
const LTP_COLS      = ['LTP', 'Last Price', 'Current Value'] as const
const TYPE_COLS     = ['Type', 'Holding Type', 'Asset Type'] as const

// ── Helpers ───────────────────────────────────────────────────────────────────

function findCol(row: Record<string, unknown>, candidates: readonly string[]): unknown {
  for (const key of candidates) {
    if (key in row && row[key] !== '' && row[key] != null) return row[key]
  }
  return undefined
}

function toNumber(val: unknown): number | null {
  if (typeof val === 'number' && isFinite(val)) return val
  if (typeof val === 'string') {
    // Strip currency symbols, commas: "₹1,234.56" → "1234.56"
    const cleaned = val.replace(/[₹,\s]/g, '').trim()
    const n = parseFloat(cleaned)
    return isFinite(n) ? n : null
  }
  return null
}

function isValidISIN(isin: unknown): boolean {
  return typeof isin === 'string' && /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(isin.trim())
}

function isValidSymbol(sym: unknown): boolean {
  return typeof sym === 'string' && sym.trim().length > 0
}

function parseHoldingType(rawType: unknown): ZerodhaHolding['type'] {
  const type = String(rawType ?? '').trim().toLowerCase()
  if (type === 'mf' || type.includes('mutual')) return 'mf'
  return 'stock'
}

// ── Normalise headers ─────────────────────────────────────────────────────────
// Some exports have leading/trailing spaces or mixed case: " Avg. cost "
function normaliseRow(raw: CSVRow): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(raw)) {
    out[k.trim()] = v
  }
  return out
}

// ── Row validator ─────────────────────────────────────────────────────────────

function parseRow(
  raw: CSVRow,
  index: number,
  skippedReasons: string[],
): ZerodhaHolding | null {
  const row = normaliseRow(raw) as ZerodhaHoldingsRow

  const rawSymbol   = findCol(row, SYMBOL_COLS)
  const rawISIN     = findCol(row, ISIN_COLS)
  const rawQty      = findCol(row, QUANTITY_COLS)
  const rawAvgCost  = findCol(row, AVGCOST_COLS)
  const rawLTP      = findCol(row, LTP_COLS)
  const rawType     = findCol(row, TYPE_COLS)

  // ── Validations ────────────────────────────────────────────────────────────

  if (!isValidSymbol(rawSymbol)) {
    skippedReasons.push(`Row ${index}: missing or invalid symbol (got "${rawSymbol}")`)
    return null
  }

  const symbol = (rawSymbol as string).trim().toUpperCase()

  // Skip summary / header rows that Zerodha sometimes appends at the bottom
  if (symbol === 'TOTAL' || symbol === 'GRAND TOTAL' || symbol === 'SYMBOL') {
    skippedReasons.push(`Row ${index}: skipped summary row "${symbol}"`)
    return null
  }

  // ISIN: warn but don't reject — some exports omit it
  const isin = isValidISIN(rawISIN) ? (rawISIN as string).trim() : ''
  if (!isin) {
    skippedReasons.push(`Row ${index} (${symbol}): ISIN missing or invalid — proceeding without it`)
  }

  const quantity = toNumber(rawQty)
  if (quantity === null || quantity <= 0) {
    skippedReasons.push(
      `Row ${index} (${symbol}): invalid quantity "${rawQty}" — must be a positive number`,
    )
    return null
  }

  // avgCost may be absent in some SOH exports — default to 0
  const avgCost = toNumber(rawAvgCost) ?? 0
  if (avgCost < 0) {
    skippedReasons.push(`Row ${index} (${symbol}): negative avgCost "${rawAvgCost}" — defaulting to 0`)
  }

  const ltp = toNumber(rawLTP) ?? undefined

  return {
    symbol,
    isin,
    quantity,
    avgCost:  Math.max(0, avgCost),
    ltp,
    type:     parseHoldingType(rawType),
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Parse rows from a Zerodha holdings CSV (already parsed by PapaParse).
 *
 * Handles all known Zerodha column name variants (Kite, Console, SOH).
 * Invalid rows are skipped with diagnostic reasons — never throws.
 *
 * @example
 * const { parsed } = await uploadCSV(file)
 * const { holdings, skipped } = parseZerodhaHoldings(parsed.rows)
 * // holdings[0] → { symbol: 'INFY', isin: 'INE009A01021', quantity: 50, avgCost: 1421.3 }
 */
export function parseZerodhaHoldings(rows: CSVRow[]): ZerodhaParseResult {
  const holdings:       ZerodhaHolding[] = []
  const skippedReasons: string[]         = []
  let   skipped = 0

  for (let i = 0; i < rows.length; i++) {
    const holding = parseRow(rows[i], i + 2, skippedReasons)   // +2 = 1-indexed + header row
    if (holding) {
      holdings.push(holding)
    } else {
      skipped++
    }
  }

  console.info(`Parsed ${holdings.length} holdings, skipped ${skipped} rows with ${skippedReasons}`)

  return { holdings, skipped, skippedReasons }
}
