import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { fetchAMFINav } from '@/features/investments/services/amfi/amfiService'
import { resolveNAV } from '@/features/investments/services/amfi/amfiParser'
import { useStore } from '@/store'
import { useAssets } from '@/store/selectors'
import { investmentPriceQueryKeys } from '@/features/investments/pricing/queryKeys'

export interface MFRefreshResult {
  updated:  number   // assets successfully valued
  missing:  string[] // asset names with no ISIN and no name match
}

export function useMFRefresh() {
  const queryClient = useQueryClient()
  const assets      = useAssets()
  const updateAsset = useStore((s) => s.updateAsset)

  const refreshMF = useCallback(async (): Promise<MFRefreshResult> => {
    const mfAssets = assets.filter((a) => a.type === 'mf')
    if (mfAssets.length === 0) return { updated: 0, missing: [] }

    // Collect ISINs from assets that have them
    const isins = mfAssets
      .filter((a): a is typeof mfAssets[0] & { isin: string } => !!a.isin)
      .map((a) => a.isin)

    // If no ISINs available, can't fetch — return empty
    if (isins.length === 0) {
      return {
        updated: 0,
        missing: mfAssets.map((a) => a.name),
      }
    }

    const { navMap, entryMap } = await queryClient.fetchQuery({
      queryKey: investmentPriceQueryKeys.mutualFunds(isins),
      queryFn: () => fetchAMFINav(isins),
      staleTime: 15 * 60 * 1000,
    })

    let updated      = 0
    const missing: string[] = []

    for (const asset of mfAssets) {
      const nav = resolveNAV(
        navMap,
        entryMap,
        asset.isin || asset.schemeCode,    // primary: exact ISIN/schemeCode match
        asset.name,          // fallback: fuzzy name match
      )

      if (nav === undefined) {
        // Can't value this asset — surface it so UI can warn the user
        missing.push(asset.name)
        continue
      }

      const units = asset.quantity ?? 0
      updateAsset(asset.id, {
        value:       parseFloat((units * nav).toFixed(2)),
        lastUpdated: Date.now(),
        // Store the resolved NAV for display in AssetCard
        lastNAV:     nav,
      })

      updated++
    }

    return { updated, missing }
  }, [assets, queryClient, updateAsset])

  return { refreshMF }
}
