import type { VercelRequest, VercelResponse } from '@vercel/node'

// Normalize symbols for Yahoo (default to NSE)
function normalizeSymbol(symbol: string): string {
  const s = symbol.trim().toUpperCase()

  if (!s) return s

  // If already has exchange suffix (.NS, .BO, etc), keep it
  if (s.includes('.')) return s

  // Default to NSE
  return `${s}.NS`
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET')

  try {
    let { symbols } = req.query

    if (!symbols || typeof symbols !== 'string') {
      return res.status(400).json({ error: 'Missing symbols query param' })
    }

    const symbolList = symbols
      .split(',')
      .map(s => normalizeSymbol(s))
      .filter(Boolean)
    
    symbols = symbols.split(',');

    if (symbolList.length === 0) {
      return res.status(400).json({ error: 'No valid symbols provided' })
    }

    // Prevent abuse
    if (symbolList.length > 10) {
      return res.status(400).json({ error: 'Max 10 symbols allowed per request' })
    }

    // Fetch in parallel
    const results = await Promise.all(
      symbolList.map(async (symbol, idx) => {
        try {
          const url = `https://query2.finance.yahoo.com/v8/finance/chart/${symbol}`

          const response = await fetch(url, {
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
              Accept: 'application/json',
            },
          })

          if (!response.ok) {
            return {
              symbol,
              error: `Failed (${response.status})`,
            }
          }

          const data = await response.json()
          const result = data?.chart?.result?.[0]

          if (!result) {
            return {
              symbol,
              error: 'No data',
            }
          }

          const meta = result.meta

          const price = meta?.regularMarketPrice ?? null
          const prev = meta?.previousClose ?? null

          return {
            symbol: symbols[idx],
            price,
            previousClose: prev,
            change: price && prev ? price - prev : null,
            changePercent:
              price && prev ? ((price - prev) / prev) * 100 : null,
            currency: meta?.currency ?? 'INR',
            marketState: meta?.marketState ?? 'UNKNOWN',
          }
        } catch (err) {
          return {
            symbol,
            error: 'Fetch failed',
          }
        }
      })
    )

    // Cache for performance + rate limiting protection
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate')

    return res.status(200).json({
      data: results,
    })
  } catch (err) {
    console.error('[yahoo proxy error]', err)

    return res.status(500).json({
      error: 'Internal server error',
    })
  }
}