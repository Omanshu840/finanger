import { useCallback } from 'react'
import { nanoid } from 'nanoid'
import { parseZerodhaHoldings } from '@/features/investments/services/zerodha/zerodhaHoldingsParser'
import { useStore } from '@/store'
import type { CSVRow } from '@/features/investments/types/csv.types'
import type { Asset } from '@/features/investments/types/asset.types'

export interface ImportResult {
  imported: number    // assets added to store
  skipped:  number    // rows that failed validation
  dupes:    number    // rows merged with existing assets
}

/**
 * Build a ticker→assetId map from existing store assets
 * so we can detect and handle duplicates during import.
 */
function buildSymbolIndex(assets: Asset[]): Map<string, string> {
  return new Map(
    assets
      .filter((a) => a.type === 'stock' && a.symbol)
      .map((a) => [a.symbol!.toUpperCase(), a.id]),
  )
}

export function useZerodhaImport() {
  const addAsset    = useStore((s) => s.addAsset)
  const updateAsset = useStore((s) => s.updateAsset)
  const assets      = useStore((s) => s.assets)

  const importHoldings = useCallback(
    (rows: CSVRow[]): ImportResult => {
      const { holdings, skipped, skippedReasons } = parseZerodhaHoldings(rows)

      // Dev diagnostics
      if (process.env.NODE_ENV !== 'production' && skippedReasons.length > 0) {
        console.warn('[ZerodhaImport] Skipped rows:\n' + skippedReasons.join('\n'))
      }

      const symbolIndex = buildSymbolIndex(assets)
      let imported = 0
      let dupes    = 0

      for (const holding of holdings) {
        const existingId = symbolIndex.get(holding.symbol)

        if (existingId) {
          // ── Merge: update quantity + buy price on existing asset ──────────
          updateAsset(existingId, {
            quantity:    holding.quantity,
            buyPrice:    holding.avgCost,
            // Pre-seed value from LTP if available (will be overwritten on next price refresh)
            ...(holding.ltp != null && {
              value: Math.round(holding.quantity * holding.ltp),
            }),
            lastUpdated: Date.now(),
          })
          dupes++
        } else {
          // ── Create new stock asset ────────────────────────────────────────
          const asset: Asset = {
            id:          nanoid(),
            type:        'stock',
            name:        holding.symbol,    // display name — user can rename
            symbol:      holding.symbol,
            isin:        holding.isin || '',
            quantity:    holding.quantity,
            buyPrice:    holding.avgCost,
            // Pre-seed value from LTP or avgCost × qty — overwritten on refresh
            value:       holding.ltp != null
                           ? Math.round(holding.quantity * holding.ltp)
                           : Math.round(holding.quantity * holding.avgCost),
            lastUpdated: Date.now(),
          }
          addAsset(asset)
          imported++
        }
      }

      return { imported, skipped, dupes }
    },
    [assets, addAsset, updateAsset],
  )

  return { importHoldings }
}
