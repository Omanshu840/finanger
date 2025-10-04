import Papa from 'papaparse'
import * as XLSX from 'xlsx'

export interface ParsedMFHolding {
  source: 'MF'
  isin?: string
  schemeName?: string
  units: number
  sourceSymbol: string
  avgPrice?: number
}

export interface ParsedEquityHolding {
  source: 'equity'
  sourceSymbol: string
  isin?: string
  quantity: number
  mappedTicker?: string
  avgPrice?: number
}

export type ParsedHoldingWithType = ParsedMFHolding | ParsedEquityHolding

interface RawRow {
  [key: string]: string | number
}

/**
 * Normalize header to lowercase without spaces/underscores
 */
function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[\s_()-]/g, '')
}

/**
 * Detect symbol column from headers
 */
function detectSymbolColumn(headers: string[]): string | null {
  const symbolPatterns = [
    'symbol',
    'tradingsymbol',
    'ticker',
    'security',
    'isinname',
    'company',
    'instrumentname',
    'scrip'
  ]

  const normalized = headers.map(normalizeHeader)

  for (const pattern of symbolPatterns) {
    const index = normalized.findIndex(h => h === pattern || h.includes(pattern))
    if (index !== -1) return headers[index]
  }

  return null
}

/**
 * Detect quantity column from headers
 */
function detectQuantityColumn(headers: string[]): string | null {
  const qtyPatterns = [
    'quantityavailable',
    'quantity',
    'qty',
    'currentqty',
    'freeqty',
    'netqty',
    'netquantity',
    'balance',
    'holdingqty',
    'units'
  ]

  const normalized = headers.map(normalizeHeader)

  for (const pattern of qtyPatterns) {
    const index = normalized.findIndex(h => h === pattern || h.includes(pattern))
    if (index !== -1) return headers[index]
  }

  return null
}

/**
 * Detect ISIN column from headers
 */
function detectISINColumn(headers: string[]): string | null {
  const isinPatterns = ['isin', 'isincode', 'isinnumber']

  const normalized = headers.map(normalizeHeader)

  for (const pattern of isinPatterns) {
    const index = normalized.findIndex(h => h === pattern || h.includes(pattern))
    if (index !== -1) return headers[index]
  }

  return null
}

/**
 * Detect ISIN column from headers
 */
function detectAvgPriceColumn(headers: string[]): string | null {
  const isinPatterns = ['Average Price']

  const normalized = headers.map(normalizeHeader)

  for (const pattern of isinPatterns) {
    const index = normalized.findIndex(h => h === pattern || h.includes(pattern))
    if (index !== -1) return headers[index]
  }

  return null
}

/**
 * Detect if row is a mutual fund based on ISIN or sheet context
 */
function isMutualFund(isin?: string): boolean {
  if (!isin) return false
  return isin.trim().startsWith('INF')
}

/**
 * Process rows from a single sheet
 */
function processSheet(
  rows: RawRow[],
  headers: string[],
  sheetType: 'equity' | 'MF' | 'auto'
): ParsedHoldingWithType[] {
  const symbolColumn = detectSymbolColumn(headers)
  const qtyColumn = detectQuantityColumn(headers)
  const isinColumn = detectISINColumn(headers)
  const avgPriceColumn = detectAvgPriceColumn(headers)

  if (!symbolColumn) {
    throw new Error(`Could not detect symbol column in sheet. Found headers: ${headers.join(', ')}`)
  }

  if (!qtyColumn) {
    throw new Error(`Could not detect quantity column in sheet. Found headers: ${headers.join(', ')}`)
  }

  const holdings: ParsedHoldingWithType[] = []

  for (const row of rows) {
    const symbol = String(row[symbolColumn] || '').trim()
    const qtyStr = String(row[qtyColumn] || '0').replace(/,/g, '') // Remove commas
    const quantity = parseFloat(qtyStr)
    const isin = isinColumn ? String(row[isinColumn] || '').trim() : undefined
    const avgPrice = avgPriceColumn ? String(row[avgPriceColumn] || '').trim() : undefined

    // Skip if no symbol or zero/negative quantity
    if (!symbol || quantity <= 0 || isNaN(quantity)) {
      continue
    }

    // Determine if MF or equity
    let isMF = false
    if (sheetType === 'MF') {
      isMF = true
    } else if (sheetType === 'equity') {
      isMF = false
    } else {
      // Auto-detect based on ISIN
      isMF = isMutualFund(isin)
    }

    if (isMF) {
      holdings.push({
        source: 'MF',
        isin,
        schemeName: symbol,
        units: quantity,
        sourceSymbol: symbol,
        avgPrice: avgPrice ? parseFloat(avgPrice) : undefined
      })
    } else {
      holdings.push({
        source: 'equity',
        sourceSymbol: symbol,
        isin,
        quantity,
        avgPrice: avgPrice ? parseFloat(avgPrice) : undefined
      })
    }
  }

  return holdings
}

/**
 * Parse CSV file
 */
async function parseCSV(file: File): Promise<ParsedHoldingWithType[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const holdings = processSheet(
            results.data as RawRow[],
            results.meta.fields || [],
            'auto'
          )
          resolve(holdings)
        } catch (error) {
          reject(error)
        }
      },
      error: (error) => {
        reject(new Error(`CSV parsing failed: ${error.message}`))
      }
    })
  })
}

/**
 * Detect sheet type from sheet name
 */
function detectSheetType(sheetName: string): 'equity' | 'MF' | 'auto' {
  const normalized = sheetName.toLowerCase()
  
  if (normalized.includes('mutual') || normalized.includes('mf') || normalized.includes('fund')) {
    return 'MF'
  }
  
  if (normalized.includes('equity') || normalized.includes('stock') || normalized.includes('share')) {
    return 'equity'
  }
  
  return 'auto'
}

/**
 * Parse XLSX file (supports multiple sheets)
 */
async function parseXLSX(file: File): Promise<ParsedHoldingWithType[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const data = e.target?.result
        const workbook = XLSX.read(data, { type: 'binary' })

        console.log('📊 Found sheets:', workbook.SheetNames)

        const allHoldings: ParsedHoldingWithType[] = []

        // Process each sheet
        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName]
          const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][]

          if (jsonData.length === 0) {
            console.log(`⏭️ Skipping empty sheet: ${sheetName}`)
            continue
          }

          // First row is headers
          const headers = jsonData[0].map(String).filter(h => h)
          
          if (headers.length === 0) {
            console.log(`⏭️ Skipping sheet with no headers: ${sheetName}`)
            continue
          }

          const rows = jsonData.slice(1)
            .filter(row => row.some(cell => cell != null && cell !== ''))
            .map(row => {
              const obj: RawRow = {}
              headers.forEach((header, index) => {
                obj[header] = row[index]
              })
              return obj
            })

          if (rows.length === 0) {
            console.log(`⏭️ Skipping sheet with no data: ${sheetName}`)
            continue
          }

          // Detect sheet type
          const sheetType = detectSheetType(sheetName)
          console.log(`📄 Processing sheet "${sheetName}" as type: ${sheetType}`)

          try {
            const holdings = processSheet(rows, headers, sheetType)
            console.log(`✅ Parsed ${holdings.length} holdings from "${sheetName}"`)
            allHoldings.push(...holdings)
          } catch (error: any) {
            console.error(`❌ Error parsing sheet "${sheetName}":`, error.message)
            // Continue with other sheets
          }
        }

        if (allHoldings.length === 0) {
          throw new Error('No valid holdings found in any sheet')
        }

        resolve(allHoldings)
      } catch (error: any) {
        reject(new Error(`XLSX parsing failed: ${error.message}`))
      }
    }

    reader.onerror = () => {
      reject(new Error('Failed to read file'))
    }

    reader.readAsBinaryString(file)
  })
}

/**
 * Deduplicate holdings by symbol/ISIN
 */
function deduplicateHoldings(holdings: ParsedHoldingWithType[]): ParsedHoldingWithType[] {
  const equityMap = new Map<string, ParsedEquityHolding>()
  const mfMap = new Map<string, ParsedMFHolding>()

  for (const holding of holdings) {
    if (holding.source === 'equity') {
      const key = holding.isin || holding.sourceSymbol
      const existing = equityMap.get(key)
      if (existing) {
        existing.quantity += holding.quantity
      } else {
        equityMap.set(key, { ...holding })
      }
    } else {
      const key = holding.isin || holding.schemeName || holding.sourceSymbol
      const existing = mfMap.get(key)
      if (existing) {
        existing.units += holding.units
      } else {
        mfMap.set(key, { ...holding })
      }
    }
  }

  return [...Array.from(equityMap.values()), ...Array.from(mfMap.values())]
}

/**
 * Main parse function - handles both CSV and XLSX with multi-sheet support
 */
export async function parseHoldingsWithType(file: File): Promise<ParsedHoldingWithType[]> {
  const extension = file.name.split('.').pop()?.toLowerCase()

  let holdings: ParsedHoldingWithType[]

  if (extension === 'csv') {
    holdings = await parseCSV(file)
  } else if (extension === 'xlsx' || extension === 'xls') {
    holdings = await parseXLSX(file)
  } else {
    throw new Error('Unsupported file format. Please upload CSV or XLSX file.')
  }

  // Deduplicate
  return deduplicateHoldings(holdings)
}

/**
 * Legacy function for backward compatibility
 */
export async function parseHoldings(file: File): Promise<ParsedEquityHolding[]> {
  const holdings = await parseHoldingsWithType(file)
  return holdings.filter(h => h.source === 'equity') as ParsedEquityHolding[]
}