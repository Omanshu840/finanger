import { cn } from '@/lib/utils'
import type { ConflictResolution, ImportPreviewRow } from '@/features/investments/types/import.types'
import { formatINR } from '@/lib/currency'

const OPTIONS: { value: ConflictResolution; label: string; description: string }[] = [
  { value: 'merge',   label: 'Merge',   description: 'Update qty & avg cost, keep name' },
  { value: 'replace', label: 'Replace', description: 'Overwrite all existing fields'    },
  { value: 'skip',    label: 'Skip',    description: 'Keep existing, ignore this row'   },
]

interface ConflictRowProps {
  row:          ImportPreviewRow
  resolution:   ConflictResolution
  onResolution: (r: ConflictResolution) => void
}

export function ConflictRow({ row, resolution, onResolution }: ConflictRowProps) {
  const { holding, conflict } = row
  if (!conflict) return null

  const { existing } = conflict
  const qtyChanged   = existing.quantity  !== holding.quantity
  const costChanged  = (existing.buyPrice ?? 0) !== holding.avgCost

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-900/40 dark:bg-amber-950/20">
      {/* Symbol + change summary */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="text-sm font-semibold">{holding.symbol}</span>
          <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            {qtyChanged && (
              <span>
                Qty:&nbsp;
                <s className="opacity-60">{existing.quantity}</s>
                &nbsp;→&nbsp;
                <strong className="text-foreground">{holding.quantity}</strong>
              </span>
            )}
            {costChanged && (
              <span>
                Avg:&nbsp;
                <s className="opacity-60">{formatINR(existing.buyPrice ?? 0)}</s>
                &nbsp;→&nbsp;
                <strong className="text-foreground">{formatINR(holding.avgCost)}</strong>
              </span>
            )}
            {!qtyChanged && !costChanged && (
              <span className="text-muted-foreground">No changes detected</span>
            )}
          </div>
        </div>

        {/* Resolution picker */}
        <div
          role="radiogroup"
          aria-label={`Conflict resolution for ${holding.symbol}`}
          className="flex shrink-0 overflow-hidden rounded-md border border-border"
        >
          {OPTIONS.map(({ value, label, description }) => (
            <button
              key={value}
              role="radio"
              aria-checked={resolution === value}
              aria-label={`${label}: ${description}`}
              title={description}
              onClick={() => onResolution(value)}
              className={cn(
                'px-2.5 py-1 text-xs font-medium transition-colors',
                'border-r border-border last:border-r-0',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset',
                resolution === value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-background text-muted-foreground hover:bg-muted',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
