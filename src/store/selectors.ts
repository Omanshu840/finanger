import { useStore } from './index'
import type { AssetType } from '@/features/investments/types/asset.types'

// ── Asset selectors ──────────────────────────────────────────────────────────
export const useAssets          = () => useStore((s) => s.assets)
export const useAssetById       = (id: string) => useStore((s) => s.assets.find((a) => a.id === id))
export const useAssetsByType    = (type: AssetType) => useStore((s) => s.assets.filter((a) => a.type === type))
export const usePricedAssets    = () => useStore((s) => s.assets.filter((a) => a.type === 'stock' || a.type === 'mf'))

export const useAssetActions    = () => useStore((s) => ({
  addAsset:    s.addAsset,
  updateAsset: s.updateAsset,
  deleteAsset: s.deleteAsset,
  setAssets:   s.setAssets,
}))

// ── Snapshot selectors ───────────────────────────────────────────────────────
export const useSnapshots       = () => useStore((s) => s.snapshots)
export const useLatestSnapshot  = () => useStore((s) =>
  s.snapshots.length > 0
    ? s.snapshots.reduce((a, b) => (a.timestamp > b.timestamp ? a : b))
    : null,
)
export const useSnapshotActions = () => useStore((s) => ({ addSnapshot: s.addSnapshot }))

// ── Pricing selectors ────────────────────────────────────────────────────────
export const usePriceMap        = () => useStore((s) => s.priceMap)
export const useIsRefreshing    = () => useStore((s) => s.isRefreshing)
export const useLastRefreshedAt = () => useStore((s) => s.lastRefreshedAt)

/** Single quote for a symbol — used in AssetCard */
export const useStockQuote = (symbol?: string) =>
  useStore((s) => (symbol ? s.priceMap[symbol.toUpperCase()] : undefined))