import { useState, useMemo, useCallback } from 'react'
import { nanoid } from 'nanoid'
import { parseZerodhaHoldings } from '@/features/investments/services/zerodha/zerodhaHoldingsParser'
import { useStore } from '@/store'
import type { CSVRow } from '@/features/investments/types/csv.types'
import type { Asset } from '@/features/investments/types/asset.types'
import type {
  ImportPreviewRow,
  ImportSummary,
  ConflictResolution,
} from '@/features/investments/types/import.types'

// ─────────────────────────────────────────────────────────────────────────────

function holdingConflictKey(holding: { type: 'stock' | 'mf'; symbol: string; isin?: string }) {
  if (holding.type === 'mf' && holding.isin) return `mf:isin:${holding.isin.toUpperCase()}`
  return `${holding.type}:symbol:${holding.symbol.toUpperCase()}`
}

function assetConflictKey(asset: Asset) {
  if (asset.type === 'mf') {
    if (asset.isin) return `mf:isin:${asset.isin.toUpperCase()}`
    return `mf:symbol:${asset.name.toUpperCase()}`
  }

  if (asset.type === 'stock' && asset.symbol) {
    return `stock:symbol:${asset.symbol.toUpperCase()}`
  }

  return null
}

export function useImportPreview(rows: CSVRow[]) {
  const assets      = useStore((s) => s.assets)
  const addAsset    = useStore((s) => s.addAsset)
  const updateAsset = useStore((s) => s.updateAsset)

  // ── Parse once, memoised ──────────────────────────────────────────────────
  const { holdings, skipped: parseSkipped } = useMemo(
    () => parseZerodhaHoldings(rows),
    [rows],
  )

  // typed import key → existing asset
  const assetIndex = useMemo<Map<string, Asset>>(
    () =>
      new Map(
        assets
          .map((asset) => [assetConflictKey(asset), asset] as const)
          .filter((entry): entry is [string, Asset] => entry[0] !== null),
      ),
    [assets],
  )

  // ── Build preview rows with conflict detection ────────────────────────────
  const previewRows = useMemo<ImportPreviewRow[]>(
    () =>
      holdings.map((holding) => {
        const existing = assetIndex.get(holdingConflictKey(holding)) ?? null
        return {
          holding,
          conflict: existing
            ? { incoming: holding, existing, resolution: 'merge' }
            : null,
        }
      }),
    [holdings, assetIndex],
  )

  // ── Per-row resolution overrides ──────────────────────────────────────────
  const [resolutions, setResolutions] = useState<
    Record<string, ConflictResolution>
  >({})

  const setResolution = useCallback(
    (key: string, resolution: ConflictResolution) =>
      setResolutions((prev) => ({ ...prev, [key]: resolution })),
    [],
  )

  const setAllResolutions = useCallback(
    (resolution: ConflictResolution) =>
      setResolutions(
        Object.fromEntries(
          previewRows
            .filter((r) => r.conflict)
            .map((r) => [holdingConflictKey(r.holding), resolution]),
        ),
      ),
    [previewRows],
  )

  // Effective resolution for a holding key (user override → default 'merge')
  const effectiveResolution = useCallback(
    (key: string): ConflictResolution =>
      resolutions[key] ?? 'merge',
    [resolutions],
  )

  // ── Execute confirmed import ──────────────────────────────────────────────
  const confirmImport = useCallback((): ImportSummary => {
    const summary: ImportSummary = { added: 0, merged: 0, replaced: 0, skipped: 0 }

    for (const { holding, conflict } of previewRows) {
      if (!conflict) {
        // ── New asset ───────────────────────────────────────────────────────
        const asset: Asset = {
          id:          nanoid(),
          type:        holding.type,
          name:        holding.symbol,
          symbol:      holding.symbol,
          isin:        holding.isin || '',
          quantity:    holding.quantity,
          buyPrice:    holding.avgCost,
          value:       holding.ltp != null
                         ? Math.round(holding.quantity * holding.ltp)
                         : Math.round(holding.quantity * holding.avgCost),
          lastUpdated: Date.now(),
        }
        addAsset(asset)
        summary.added++
        continue
      }

      const resolution = effectiveResolution(holdingConflictKey(holding))

      if (resolution === 'skip') {
        summary.skipped++
        continue
      }

      if (resolution === 'replace') {
        // Overwrite all fields
        updateAsset(conflict.existing.id, {
          quantity:    holding.quantity,
          buyPrice:    holding.avgCost,
          isin:        holding.isin || conflict.existing.isin,
          value:       holding.ltp != null
                         ? Math.round(holding.quantity * holding.ltp)
                         : Math.round(holding.quantity * holding.avgCost),
          lastUpdated: Date.now(),
        })
        summary.replaced++
        continue
      }

      // 'merge' — update quantity + buyPrice, keep existing name/notes
      updateAsset(conflict.existing.id, {
        quantity:    holding.quantity,
        buyPrice:    holding.avgCost,
        ...(holding.isin && !conflict.existing.isin && { isin: holding.isin }),
        ...(holding.ltp != null && {
          value: Math.round(holding.quantity * holding.ltp),
        }),
        lastUpdated: Date.now(),
      })
      summary.merged++
    }

    return { ...summary, skipped: summary.skipped + parseSkipped }
  }, [previewRows, effectiveResolution, addAsset, updateAsset, parseSkipped])

  const hasConflicts   = previewRows.some((r) => r.conflict !== null)
  const conflictCount  = previewRows.filter((r) => r.conflict !== null).length
  const newCount       = previewRows.filter((r) => r.conflict === null).length

  return {
    previewRows,
    parseSkipped,
    hasConflicts,
    conflictCount,
    newCount,
    effectiveResolution,
    setResolution,
    setAllResolutions,
    confirmImport,
    holdingConflictKey,
  }
}
