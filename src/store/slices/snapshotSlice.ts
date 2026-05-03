import { type StateCreator } from 'zustand'
import type { Snapshot } from '@/features/investments/types/asset.types'
import type { RootStore } from '../index'

export interface SnapshotSlice {
  snapshots: Snapshot[]
  addSnapshot: (snapshot: Snapshot) => void
}

export const createSnapshotSlice: StateCreator<
  RootStore,
  [['zustand/devtools', never], ['zustand/persist', unknown], ['zustand/immer', never]],
  [],
  SnapshotSlice
> = (set) => ({
  snapshots: [],

  addSnapshot: (snapshot) =>
    set((state) => {
      state.snapshots.push(snapshot)
    }),
})