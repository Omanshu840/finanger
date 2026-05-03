import { type StateCreator } from 'zustand'
import type { Asset } from '@/features/investments/types/asset.types'
import type { RootStore } from '../index'

export interface AssetSlice {
  assets: Asset[]
  addAsset: (asset: Asset) => void
  updateAsset: (id: string, patch: Partial<Asset>) => void
  deleteAsset: (id: string) => void
  setAssets: (assets: Asset[]) => void
}

// StateCreator typed against full RootStore so slices can cross-call
export const createAssetSlice: StateCreator<
  RootStore,
  [['zustand/devtools', never], ['zustand/persist', unknown], ['zustand/immer', never]],
  [],
  AssetSlice
> = (set) => ({
  assets: [],

  addAsset: (asset) =>
    set((state) => {
      state.assets.push(asset)
    }),

  updateAsset: (id, patch) =>
    set((state) => {
      const idx = state.assets.findIndex((a) => a.id === id)
      if (idx !== -1) Object.assign(state.assets[idx], patch)
    }),

  deleteAsset: (id) =>
    set((state) => {
      state.assets = state.assets.filter((a) => a.id !== id)
    }),

  setAssets: (assets) =>
    set((state) => {
      state.assets = assets
    }),
})