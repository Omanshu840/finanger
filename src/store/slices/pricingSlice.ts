import { type StateCreator } from 'zustand'
import type { PriceMap } from '@/features/investments/types/pricing.types'
import type { RootStore } from '../index'

export interface PricingSlice {
  priceMap:        PriceMap       // symbol → StockQuote (in-memory only, not persisted)
  lastRefreshedAt: number | null  // unix ms
  isRefreshing:    boolean

  setPriceMap:        (map: PriceMap) => void
  setIsRefreshing:    (val: boolean) => void
  setLastRefreshedAt: (ts: number) => void
}

export const createPricingSlice: StateCreator<
  RootStore,
  [['zustand/devtools', never], ['zustand/persist', unknown], ['zustand/immer', never]],
  [],
  PricingSlice
> = (set) => ({
  priceMap:        {},
  lastRefreshedAt: null,
  isRefreshing:    false,

  setPriceMap: (map) =>
    set((state) => { state.priceMap = map }),

  setIsRefreshing: (val) =>
    set((state) => { state.isRefreshing = val }),

  setLastRefreshedAt: (ts) =>
    set((state) => { state.lastRefreshedAt = ts }),
})