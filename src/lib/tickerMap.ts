/**
 * Common NSE ticker mappings
 */
const COMMON_NSE_TICKERS: Record<string, string> = {
  'RELIANCE': 'RELIANCE.NS',
  'TCS': 'TCS.NS',
  'HDFCBANK': 'HDFCBANK.NS',
  'INFY': 'INFY.NS',
  'ICICIBANK': 'ICICIBANK.NS',
  'HINDUNILVR': 'HINDUNILVR.NS',
  'ITC': 'ITC.NS',
  'SBIN': 'SBIN.NS',
  'BHARTIARTL': 'BHARTIARTL.NS',
  'KOTAKBANK': 'KOTAKBANK.NS',
  'LT': 'LT.NS',
  'AXISBANK': 'AXISBANK.NS',
  'ASIANPAINT': 'ASIANPAINT.NS',
  'MARUTI': 'MARUTI.NS',
  'TITAN': 'TITAN.NS',
  'SUNPHARMA': 'SUNPHARMA.NS',
  'ULTRACEMCO': 'ULTRACEMCO.NS',
  'BAJFINANCE': 'BAJFINANCE.NS',
  'NESTLEIND': 'NESTLEIND.NS',
  'WIPRO': 'WIPRO.NS'
}

/**
 * Strip series suffixes from NSE symbols
 */
function stripSeries(symbol: string): string {
  // Remove series like -BE, -BL, -BZ, -EQ, etc.
  return symbol.replace(/-(BE|BL|BZ|EQ|SM|IL|IN)$/i, '')
}

/**
 * Map NSE symbol to Yahoo Finance ticker
 */
export function mapNSEToYahoo(symbol: string): string {
  if (!symbol) return ''

  // Remove whitespace and convert to uppercase
  let cleaned = symbol.trim().toUpperCase()

  // Already has .NS or .BO suffix
  if (cleaned.endsWith('.NS') || cleaned.endsWith('.BO')) {
    return cleaned
  }

  // Strip series suffix
  cleaned = stripSeries(cleaned)

  // Check common mappings first
  if (COMMON_NSE_TICKERS[cleaned]) {
    return COMMON_NSE_TICKERS[cleaned]
  }

  // Default to NSE suffix
  return `${cleaned}.NS`
}

/**
 * Map BSE symbol to Yahoo Finance ticker
 */
export function mapBSEToYahoo(symbol: string): string {
  if (!symbol) return ''

  let cleaned = symbol.trim().toUpperCase()

  if (cleaned.endsWith('.BO')) {
    return cleaned
  }

  // BSE codes are numeric, just add .BO
  return `${cleaned}.BO`
}

/**
 * Detect if symbol is BSE code (numeric)
 */
export function isBSECode(symbol: string): boolean {
  return /^\d{6}$/.test(symbol.trim())
}

/**
 * Smart ticker mapping
 */
export function mapToYahoo(symbol: string): string {
  if (!symbol) return ''

  // If already mapped, return as-is
  if (symbol.includes('.')) {
    return symbol.toUpperCase()
  }

  // Check if BSE code
  if (isBSECode(symbol)) {
    return mapBSEToYahoo(symbol)
  }

  // Default to NSE
  return mapNSEToYahoo(symbol)
}
