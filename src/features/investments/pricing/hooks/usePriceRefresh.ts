import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { fetchStockPrices } from '@/features/investments/services/api/yahooFinanceService'
import { useStore } from '@/store'
import { useAssets, useIsRefreshing } from '@/store/selectors'
import { useMFRefresh } from './useMFRefresh'
import type { FetchPricesResult } from '@/features/investments/types/pricing.types'
import { investmentPriceQueryKeys } from '@/features/investments/pricing/queryKeys'

export interface RefreshSummary {
  stocksUpdated: number
  mfUpdated:     number
  errors: {
    stocks: Record<string, string>  // symbol → error message
    mf:     string[]                // asset names with missing/unresolved scheme
  }
}

export function usePriceRefresh() {
  const queryClient     = useQueryClient()
  const assets         = useAssets()
  const isRefreshing   = useIsRefreshing()
  const updateAsset    = useStore((s) => s.updateAsset)
  const setPriceMap    = useStore((s) => s.setPriceMap)
  const setRefreshing  = useStore((s) => s.setIsRefreshing)
  const setRefreshedAt = useStore((s) => s.setLastRefreshedAt)

  const { refreshMF } = useMFRefresh()

  const refresh = useCallback(async (): Promise<RefreshSummary | void> => {
    if (isRefreshing) return
    setRefreshing(true)

    const summary: RefreshSummary = {
      stocksUpdated: 0,
      mfUpdated:     0,
      errors: { stocks: {}, mf: [] },
    }

    try {
      const stockAssets = assets.filter((a) => a.type === 'stock' && a.symbol)

      // ── Run stock + MF fetches concurrently ──────────────────────────────
      const [stockResult, mfResult] = await Promise.allSettled([
        // Stock fetch (skipped silently if no stock assets)
        stockAssets.length > 0
          ? queryClient.fetchQuery({
              queryKey: investmentPriceQueryKeys.stocks(stockAssets.map((a) => a.symbol!)),
              queryFn: () => fetchStockPrices(stockAssets.map((a) => a.symbol!)),
              staleTime: 5 * 60 * 1000,
            })
          : Promise.resolve<FetchPricesResult>({ prices: {}, errors: {} }),

        // MF fetch
        refreshMF(),
      ])

      // ── Apply stock results ──────────────────────────────────────────────
      if (stockResult.status === 'fulfilled') {
        const { prices, errors } = stockResult.value

        setPriceMap(prices)
        summary.errors.stocks = errors

        for (const asset of stockAssets) {
          const quote = prices[asset.symbol!.toUpperCase()]
          if (!quote) continue

          updateAsset(asset.id, {
            value:       parseFloat(((asset.quantity ?? 1) * quote.price).toFixed(2)),
            lastUpdated: quote.fetchedAt,
          })
          summary.stocksUpdated++
        }
      } else {
        // Entire stock fetch failed (network down, proxy error)
        const msg = (stockResult.reason as Error)?.message ?? 'Network error'
        for (const a of stockAssets) summary.errors.stocks[a.symbol!] = msg
      }

      // ── Apply MF results ─────────────────────────────────────────────────
      if (mfResult.status === 'fulfilled') {
        summary.mfUpdated      = mfResult.value.updated
        summary.errors.mf      = mfResult.value.missing
      } else {
        // AMFI fetch itself failed (proxy down, parse error)
        summary.errors.mf = assets
          .filter((a) => a.type === 'mf')
          .map((a) => a.name)
      }

      setRefreshedAt(Date.now())
      return summary

    } finally {
      setRefreshing(false)
    }
  }, [
    assets, isRefreshing, queryClient,
    updateAsset, setPriceMap, setRefreshing, setRefreshedAt,
    refreshMF,
  ])

  return { refresh, isRefreshing }
}
