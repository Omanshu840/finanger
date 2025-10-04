export interface QuoteData {
  price: number | null
  currency: string
  previousClose?: number
}

const YAHOO_QUOTE_URL = 'https://query1.finance.yahoo.com/v7/finance/quote'
const BATCH_SIZE = 50
const RATE_LIMIT_DELAY = 1000 // 1 second between batches

/**
 * Fetch quotes from Yahoo Finance
 */
export async function fetchQuotes(
  tickers: string[]
): Promise<Record<string, QuoteData>> {
  const results: Record<string, QuoteData> = {}

  // Split into batches
  const batches: string[][] = []
  for (let i = 0; i < tickers.length; i += BATCH_SIZE) {
    batches.push(tickers.slice(i, i + BATCH_SIZE))
  }

  // Process batches with delay
  for (let i = 0; i < batches.length; i++) {
    if (i > 0) {
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY))
    }

    try {
      const batchResults = await fetchBatch(batches[i])
      Object.assign(results, batchResults)
    } catch (error) {
      console.error('Batch fetch error:', error)
      // Mark all tickers in this batch as failed
      for (const ticker of batches[i]) {
        results[ticker] = { price: null, currency: 'INR' }
      }
    }
  }

  return results
}

/**
 * Fetch a single batch of quotes
 */
async function fetchBatch(tickers: string[]): Promise<Record<string, QuoteData>> {
  const url = `${YAHOO_QUOTE_URL}?symbols=${tickers.join(',')}`

  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const data = await response.json()

    if (!data.quoteResponse || !data.quoteResponse.result) {
      throw new Error('Invalid response format')
    }

    const results: Record<string, QuoteData> = {}

    for (const quote of data.quoteResponse.result) {
      const ticker = quote.symbol as string

      // Try to get price in this order
      let price = quote.regularMarketPrice
      if (price == null) price = quote.postMarketPrice
      if (price == null) price = quote.previousClose
      if (price == null) price = quote.bid
      if (price == null) price = quote.ask

      results[ticker] = {
        price: price != null ? Number(price) : null,
        currency: quote.currency || 'INR',
        previousClose: quote.previousClose ? Number(quote.previousClose) : undefined
      }
    }

    // Mark any missing tickers as null
    for (const ticker of tickers) {
      if (!results[ticker]) {
        results[ticker] = { price: null, currency: 'INR' }
      }
    }

    return results
  } catch (error: any) {
    console.error('Yahoo Finance fetch error:', error)
    throw error
  }
}

/**
 * Validate if ticker exists on Yahoo
 */
export async function validateTicker(ticker: string): Promise<boolean> {
  try {
    const results = await fetchQuotes([ticker])
    return results[ticker]?.price != null
  } catch {
    return false
  }
}
