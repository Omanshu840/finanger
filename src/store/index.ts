import { create } from 'zustand'
import { devtools, persist, createJSONStorage } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'

import { createAssetSlice, type AssetSlice } from './slices/assetSlice'
import { createSnapshotSlice, type SnapshotSlice } from './slices/snapshotSlice'
import { createPricingSlice, type PricingSlice } from './slices/pricingSlice'

// ─── Combined store type ────────────────────────────────────────────────────
export type RootStore = AssetSlice & SnapshotSlice & PricingSlice

type PersistedAsset = RootStore['assets'][number] & {
  avgCost?: number
  averageCost?: number
}

function migrateAssets(assets: RootStore['assets'] | undefined) {
  if (!assets) return assets

  return assets.map((asset) => {
    const legacy = asset as PersistedAsset
    const buyPrice =
      asset.buyPrice ??
      (legacy.avgCost != null && legacy.avgCost > 0 ? legacy.avgCost : undefined) ??
      (legacy.averageCost != null && legacy.averageCost > 0 ? legacy.averageCost : undefined)

    const { avgCost, averageCost, ...normalized } = legacy
    void avgCost
    void averageCost

    return {
      schemeCode: '',
      ...normalized,
      ...(buyPrice != null && { buyPrice }),
    }
  })
}

// ─── Middleware stack order: devtools → persist → immer ────────────────────
//     devtools must wrap everything to see all mutations.
//     persist sits inside devtools so hydration is also tracked.
//     immer is innermost — it processes set() calls first.
export const useStore = create<RootStore>()(
  devtools(
    persist(
      immer((...a) => ({
        ...createAssetSlice(...a),
        ...createSnapshotSlice(...a),
        ...createPricingSlice(...a),
      })),
      {
        name: 'wealth-dashboard-v1',
        storage: createJSONStorage(() => localStorage),
        version: 2,

        // Only persist data — never actions (functions)
        partialize: (state) => ({
          assets: state.assets,
          snapshots: state.snapshots,
          lastRefreshedAt: state.lastRefreshedAt,  // persist timestamp only
        }),

        // Schema migration — increment version when Asset shape changes
        migrate: (persisted: unknown, fromVersion: number) => {
          const data = persisted as Partial<RootStore>
          if (fromVersion < 2) {
            data.assets = migrateAssets(data.assets)
          }
          return data as RootStore
        },
      },
    ),
    { name: 'WealthDashboard' }, // devtools display name
  ),
)
