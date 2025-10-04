import { type Holding } from './holdings'
import { fetchQuotes } from './yahoo'
import { ensureAMFIIndex, lookupByISIN } from './amfi'

export interface HoldingWithPrice extends Holding {
  currentPrice: number | null
  priceDate?: string
  marketValue: number | null
  costBasis: number
  unrealizedPnL: number | null
  unrealizedPnLPct: number | null
  priceSource: 'yahoo' | 'amfi' | 'manual'
}

/**
 * Fetch live prices for equity holdings using Yahoo Finance
 */
export async function fetchEquityPrices(
  holdings: Holding[],
  tickerMap: Map<string, string> // assetId -> yahoo ticker
): Promise<Map<string, { price: number; currency: string }>> {
  const prices = new Map<string, { price: number; currency: string }>()

  // Get unique tickers
  const tickers = Array.from(new Set(
    holdings
      .map(h => tickerMap.get(h.asset_id))
      .filter(Boolean) as string[]
  ))

  if (tickers.length === 0) return prices

  try {
    console.log('📈 Fetching Yahoo prices for', tickers.length, 'tickers')
    const quotes = await fetchQuotes(tickers)

    // Map back to asset IDs
    for (const holding of holdings) {
      const ticker = tickerMap.get(holding.asset_id)
      if (ticker && quotes[ticker]?.price) {
        prices.set(holding.asset_id, {
          price: quotes[ticker].price!,
          currency: quotes[ticker].currency
        })
      }
    }

    console.log('✅ Fetched prices for', prices.size, 'assets')
  } catch (error) {
    console.error('❌ Failed to fetch Yahoo prices:', error)
  }

  return prices
}

/**
 * Fetch live NAVs for mutual fund holdings using AMFI
 */
export async function fetchMFNAVs(
  holdings: Holding[],
  isinMap: Map<string, string> // assetId -> ISIN
): Promise<Map<string, { nav: number; date: string }>> {
  const navs = new Map<string, { nav: number; date: string }>()

  try {
    console.log('📊 Fetching AMFI NAVs for', holdings.length, 'MF holdings')
    const amfiIndex = await ensureAMFIIndex()

    for (const holding of holdings) {
      const isin = isinMap.get(holding.asset_id)
      if (!isin) continue

      const record = lookupByISIN(amfiIndex, isin)
      if (record) {
        navs.set(holding.asset_id, {
          nav: record.nav,
          date: record.date
        })
      }
    }

    console.log('✅ Fetched NAVs for', navs.size, 'MF assets')
  } catch (error) {
    console.error('❌ Failed to fetch AMFI NAVs:', error)
  }

  return navs
}

/**
 * Enrich holdings with live prices and valuation
 */
export async function enrichHoldingsWithPrices(
  equityHoldings: Holding[],
  mfHoldings: Holding[],
  equityTickerMap: Map<string, string>,
  mfIsinMap: Map<string, string>
): Promise<HoldingWithPrice[]> {
  const enriched: HoldingWithPrice[] = []

  // Fetch prices in parallel
  const [equityPrices, mfNAVs] = await Promise.all([
    fetchEquityPrices(equityHoldings, equityTickerMap),
    fetchMFNAVs(mfHoldings, mfIsinMap)
  ])

  // Enrich equity holdings
  for (const holding of equityHoldings) {
    const priceData = equityPrices.get(holding.asset_id)
    const currentPrice = priceData?.price || null
    const marketValue = currentPrice ? holding.quantity * currentPrice : null
    const unrealizedPnL = marketValue ? marketValue - holding.cost_basis : null
    const unrealizedPnLPct = unrealizedPnL && holding.cost_basis > 0
      ? (unrealizedPnL / holding.cost_basis) * 100
      : null

    enriched.push({
      ...holding,
      currentPrice,
      marketValue,
      costBasis: holding.cost_basis,
      unrealizedPnL,
      unrealizedPnLPct,
      priceSource: currentPrice ? 'yahoo' : 'manual'
    })
  }

  // Enrich MF holdings
  for (const holding of mfHoldings) {
    const navData = mfNAVs.get(holding.asset_id)
    const currentPrice = navData?.nav || null
    const marketValue = currentPrice ? holding.quantity * currentPrice : null
    const unrealizedPnL = marketValue ? marketValue - holding.cost_basis : null
    const unrealizedPnLPct = unrealizedPnL && holding.cost_basis > 0
      ? (unrealizedPnL / holding.cost_basis) * 100
      : null

    enriched.push({
      ...holding,
      currentPrice,
      priceDate: navData?.date,
      marketValue,
      costBasis: holding.cost_basis,
      unrealizedPnL,
      unrealizedPnLPct,
      priceSource: currentPrice ? 'amfi' : 'manual'
    })
  }

  return enriched
}
