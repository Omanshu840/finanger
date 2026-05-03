import type {
  FetchPricesResult,
  PriceMap,
  PriceErrorMap,
  StockQuote,
  YahooProxyResponse,
} from '@/features/investments/types/pricing.types'
import { PROXY } from './proxyConfig'

// ── Constants ────────────────────────────────────────────────────────────────

const FETCH_TIMEOUT_MS = 10_000
const MAX_SYMBOLS_PER_REQUEST = 20   // keep proxy URLs reasonable
const RETRY_ATTEMPTS = 2
const RETRY_DELAY_MS = 800

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Split an array into chunks of at most `size` */
function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size))
  }
  return chunks
}

/** fetch() with an AbortController timeout */
async function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try {
    return await fetch(url, { signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

/** Exponential-ish retry wrapper */
async function withRetry<T>(
  fn: () => Promise<T>,
  attempts: number,
  delayMs: number,
): Promise<T> {
  let lastError: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, delayMs * (i + 1)))
      }
    }
  }
  throw lastError
}

// ── Parser ───────────────────────────────────────────────────────────────────

/**
 * Extract a StockQuote from a Yahoo proxy response item.
 * Returns null if the item is malformed.
 */
function parseYahooResult(
  item: any,
): StockQuote | null {
  if (!item || typeof item.symbol !== 'string' || typeof item.price !== 'number') {
    return null
  }

  const symbol = item.symbol.trim().toUpperCase()
  const price = item.price
  const prevClose = item.previousClose ?? price
  const change = item.change ?? (price - prevClose)
  const changePercent = item.changePercent ?? 0  // already in percent from proxy

  return {
    symbol,
    price,
    previousClose: prevClose,
    change,
    changePercent,
    currency:    item.currency ?? 'INR',
    marketState: (item.marketState?.toUpperCase() ?? 'CLOSED') as any,
    shortName:   symbol,
    fetchedAt:   Date.now(),
  }
}

// ── Core fetch (one chunk) ───────────────────────────────────────────────────

async function fetchChunk(
  symbols: string[],
): Promise<{ prices: PriceMap; errors: PriceErrorMap }> {
  const url    = PROXY.yahoo(symbols)
  const prices: PriceMap     = {}
  const errors: PriceErrorMap = {}

  const response = await fetchWithTimeout(url, FETCH_TIMEOUT_MS)

  if (!response.ok) {
    // Entire chunk failed — mark all symbols as errored
    const reason = `HTTP ${response.status}: ${response.statusText}`
    for (const s of symbols) errors[s] = reason
    return { prices, errors }
  }

  let data: YahooProxyResponse
  try {
    data = await response.json()
  } catch {
    for (const s of symbols) errors[s] = 'Invalid JSON from proxy'
    return { prices, errors }
  }

  // The response has a { data: [...] } structure
  const items = Array.isArray(data?.data) ? data.data : []
  const resultMap = new Map<string, any>()
  
  // Parse each item and build a map by symbol
  for (const item of items) {
    const quote = parseYahooResult(item)
    if (quote) {
      resultMap.set(quote.symbol, quote)
    }
  }

  // For requested symbols, assign price or error
  for (const symbol of symbols) {
    const normalizedSymbol = symbol.trim().toUpperCase()
    const quote = resultMap.get(normalizedSymbol)
    
    if (quote) {
      prices[normalizedSymbol] = quote
    } else {
      errors[normalizedSymbol] = 'Symbol not found or no price data'
    }
  }

  return { prices, errors }
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch current market prices for an array of symbols.
 *
 * - Deduplicates symbols
 * - Splits into chunks of 20 (proxy URL safety)
 * - Retries each chunk up to 2 times on network failure
 * - Never throws — failed symbols surface in `result.errors`
 *
 * @example
 * const { prices, errors } = await fetchStockPrices(['INFY.NS', 'TCS.NS'])
 * prices['INFY.NS'].price    // 1527.5
 * errors['XYZ.NS']           // "Symbol not found or no price data"
 */
export async function fetchStockPrices(
  symbols: string[],
): Promise<FetchPricesResult> {
  if (symbols.length === 0) return { prices: {}, errors: {} }

  // Deduplicate and normalise to uppercase
  const unique = [...new Set(symbols.map((s) => s.trim().toUpperCase()))]

  const allPrices: PriceMap     = {}
  const allErrors: PriceErrorMap = {}

  // Fetch chunks concurrently
  const chunks = chunk(unique, MAX_SYMBOLS_PER_REQUEST)

  const results = await Promise.allSettled(
    chunks.map((c) =>
      withRetry(() => fetchChunk(c), RETRY_ATTEMPTS, RETRY_DELAY_MS),
    ),
  )

  for (let i = 0; i < results.length; i++) {
    const result = results[i]

    if (result.status === 'fulfilled') {
      Object.assign(allPrices, result.value.prices)
      Object.assign(allErrors, result.value.errors)
    } else {
      // All retries exhausted for this chunk
      const message =
        result.reason instanceof Error
          ? result.reason.message
          : 'Network error'

      for (const symbol of chunks[i]) {
        allErrors[symbol] = message
      }
    }
  }

  return { prices: allPrices, errors: allErrors }
}