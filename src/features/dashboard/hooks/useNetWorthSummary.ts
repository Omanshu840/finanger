import { useMemo } from 'react'
import { useAssets } from '@/store/selectors'
import { ASSET_TYPE_CONFIG, ASSET_TYPE_ORDER } from '@/features/investments/assets/assetConfig'
import type { AssetType } from '@/features/investments/types/asset.types'
import { getAssetTypeValuations, getPortfolioValuation } from '@/features/investments/assets/assetValuation'

export interface AllocationSlice {
  type: AssetType
  label: string
  value: number
  percentage: number
  color: string          // hex — needed by Recharts SVG (Tailwind classes don't work in SVG)
}

// Recharts-safe hex colors matched to assetConfig Tailwind colours
export const ASSET_TYPE_HEX: Record<AssetType, string> = {
  stock: '#3b82f6',   // blue-500
  mf:    '#8b5cf6',   // violet-500
  bank:  '#10b981',   // emerald-500
  fd:    '#f59e0b',   // amber-500
  esop:  '#f43f5e',   // rose-500
  cash:  '#14b8a6',   // teal-500
}

export function useNetWorthSummary() {
  const assets = useAssets()

  return useMemo(() => {
    const portfolio = getPortfolioValuation(assets)
    const netWorth = portfolio.currentValue
    const byType = getAssetTypeValuations(assets)

    // Build allocation slices in display order, skip zero-value types
    const allocation: AllocationSlice[] = ASSET_TYPE_ORDER
      .filter((type) => (byType.get(type)?.currentValue ?? 0) > 0)
      .map((type) => ({
        type,
        label:      ASSET_TYPE_CONFIG[type].label,
        value:      byType.get(type)?.currentValue ?? 0,
        percentage: netWorth > 0 ? ((byType.get(type)?.currentValue ?? 0) / netWorth) * 100 : 0,
        color:      ASSET_TYPE_HEX[type],
      }))

    // Most recent lastUpdated timestamp across all assets
    const lastUpdated = assets.reduce<number | null>((latest, a) => {
      if (!a.lastUpdated) return latest
      return latest == null || a.lastUpdated > latest ? a.lastUpdated : latest
    }, null)

    return { netWorth, allocation, assetCount: assets.length, lastUpdated }
  }, [assets])
}
