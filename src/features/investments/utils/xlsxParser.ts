import * as XLSX from 'xlsx'
import type { Holding, HoldingsParseResult } from '@/features/investments/types/import.types'

const MAX_FILE_SIZE_MB = 10
const EQUITY_SHEET = 'Equity'
const MUTUAL_FUNDS_SHEET = 'Mutual Funds'

export class XLSXParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'XLSXParseError'
  }
}

interface RawHolding {
  symbol?: string | number | null
  isin?: string | number | null
  quantity?: string | number | null
  avgCost?: string | number | null
  type: 'equity' | 'mf'
}

/**
 * Parse XLSX file and extract equity and mutual fund holdings
 */
export function parseXLSXFile(file: File): Promise<HoldingsParseResult> {
  // Guard: file type
  if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
    return Promise.reject(new XLSXParseError('Only .xlsx/.xls files are supported'))
  }

  // Guard: file size
  if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
    return Promise.reject(
      new XLSXParseError(`File too large (max ${MAX_FILE_SIZE_MB} MB)`),
    )
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const data = e.target?.result
        if (!data) {
          reject(new XLSXParseError('Failed to read file'))
          return
        }

        const workbook = XLSX.read(data, { type: 'array' })

        const holdings: Holding[] = []
        const skippedReasons: string[] = []

        // Parse Equity sheet
        if (workbook.SheetNames.includes(EQUITY_SHEET)) {
          const equityHoldings = parseSheet(
            workbook,
            EQUITY_SHEET,
            'equity',
            skippedReasons,
          )
          holdings.push(...equityHoldings)
        }

        // Parse Mutual Funds sheet
        if (workbook.SheetNames.includes(MUTUAL_FUNDS_SHEET)) {
          const mfHoldings = parseSheet(
            workbook,
            MUTUAL_FUNDS_SHEET,
            'mf',
            skippedReasons,
          )
          holdings.push(...mfHoldings)
        }

        if (holdings.length === 0 && skippedReasons.length === 0) {
          reject(
            new XLSXParseError('No holdings found in the Excel file'),
          )
          return
        }

        resolve({
          holdings,
          skipped: skippedReasons.length,
          skippedReasons,
          meta: {
            fileName: file.name,
            fileSize: file.size,
            totalRows: holdings.length,
          },
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        reject(new XLSXParseError(`Failed to parse file: ${message}`))
      }
    }

    reader.onerror = () => {
      reject(new XLSXParseError('Failed to read file'))
    }

    reader.readAsArrayBuffer(file)
  })
}

/**
 * Extract holdings from a specific sheet
 */
function parseSheet(
  workbook: XLSX.WorkBook,
  sheetName: string,
  holdingType: 'equity' | 'mf',
  skippedReasons: string[],
): Holding[] {
  const worksheet = workbook.Sheets[sheetName]
  if (!worksheet) return []

  // Convert sheet to JSON - skip empty cells
  const rawData = XLSX.utils.sheet_to_json(worksheet, {
    header: 1, // Get array of arrays instead of objects
    defval: '', // Default value for empty cells
  }) as Array<Array<unknown>>

  if (rawData.length === 0) return []

  // Find header row (usually row 23, but we'll search for it)
  // Headers are: Symbol, ISIN, then other columns depending on sheet type
  let headerRowIdx = -1
  let symbolIdx = -1
  let isinIdx = -1
  let quantityIdx = -1
  let avgCostIdx = -1

  for (let i = 0; i < Math.min(rawData.length, 30); i++) {
    const row = rawData[i]
    const rowStr = row.map((v) => String(v || '').toLowerCase()).join('|')

    if (rowStr.includes('symbol') && rowStr.includes('isin')) {
      headerRowIdx = i
      // Find exact column indices
      symbolIdx = row.findIndex(
        (v) => String(v || '').toLowerCase().includes('symbol'),
      )
      isinIdx = row.findIndex((v) => String(v || '').toLowerCase().includes('isin'))
      quantityIdx = row.findIndex(
        (v) =>
          String(v || '')
            .toLowerCase()
            .includes('quantity available'),
      )
      avgCostIdx = row.findIndex(
        (v) =>
          String(v || '')
            .toLowerCase()
            .includes('average price'),
      )
      break
    }
  }

  if (headerRowIdx === -1) {
    skippedReasons.push(`No headers found in ${sheetName} sheet`)
    return []
  }

  // If average price not found (for MF sheet), try alternate column names
  if (avgCostIdx === -1 && holdingType === 'equity') {
    avgCostIdx = rawData[headerRowIdx].findIndex(
      (v) =>
        String(v || '')
          .toLowerCase()
          .includes('avg'),
    )
  }

  const holdings: Holding[] = []

  // Parse data rows
  for (let i = headerRowIdx + 1; i < rawData.length; i++) {
    const row = rawData[i]

    const rawHolding: RawHolding = {
      symbol: (row[symbolIdx] as string | number | null | undefined) || undefined,
      isin: (row[isinIdx] as string | number | null | undefined) || undefined,
      quantity: (row[quantityIdx] as string | number | null | undefined) || undefined,
      avgCost: avgCostIdx >= 0 ? (row[avgCostIdx] as string | number | null | undefined) : undefined,
      type: holdingType,
    }

    const holding = parseRow(rawHolding, i + 1, skippedReasons)
    if (holding) {
      holdings.push(holding)
    }
  }

  return holdings
}

/**
 * Parse and validate a single holding row
 */
function parseRow(
  raw: RawHolding,
  rowNum: number,
  skippedReasons: string[],
): Holding | null {
  // Validate symbol
  const symbol = String(raw.symbol || '').trim().toUpperCase()
  if (!symbol || symbol.length === 0) {
    skippedReasons.push(`Row ${rowNum}: missing symbol`)
    return null
  }

  // Validate ISIN
  const isin = String(raw.isin || '').trim()
  if (!isin || !isValidISIN(isin)) {
    skippedReasons.push(`Row ${rowNum}: invalid or missing ISIN`)
    return null
  }

  // Parse quantity
  const quantity = toNumber(raw.quantity)
  if (quantity === null || quantity <= 0) {
    skippedReasons.push(
      `Row ${rowNum}: invalid quantity (got "${raw.quantity}")`,
    )
    return null
  }

  // Parse average cost (optional)
  const avgCost = raw.avgCost ? toNumber(raw.avgCost) ?? 0 : 0

  return {
    symbol,
    isin,
    quantity,
    avgCost,
    type: raw.type,
  }
}

/**
 * Convert value to number, handling currency symbols and commas
 */
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

/**
 * Validate ISIN format: 2 letters + 9 alphanumeric + 1 digit
 */
function isValidISIN(isin: string): boolean {
  return /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(isin.trim())
}
