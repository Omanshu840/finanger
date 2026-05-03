import { cn } from '@/lib/utils'
import type { AllocationSlice } from '../hooks/useNetWorthSummary'
import { ASSET_TYPE_CONFIG } from '@/features/investments/assets/assetConfig'
import { formatINR } from '@/lib/currency'

interface AllocationBreakdownProps {
  allocation: AllocationSlice[]
}

export function AllocationBreakdown({ allocation }: AllocationBreakdownProps) {
  if (allocation.length === 0) return null

  return (
    <ul className="space-y-3" role="list" aria-label="Asset allocation breakdown">
      {allocation.map((slice) => {
        const Icon = ASSET_TYPE_CONFIG[slice.type].icon
        return (
          <li key={slice.type} className="flex flex-col gap-1.5">
            {/* Row: icon + label + value + % */}
            <div className="flex items-center gap-2">
              {/* Colour dot */}
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: slice.color }}
                aria-hidden="true"
              />

              {/* Icon + label */}
              <div className="flex flex-1 items-center gap-1.5 min-w-0">
                <Icon
                  className={cn('h-3.5 w-3.5 shrink-0', ASSET_TYPE_CONFIG[slice.type].textColor)}
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
                <span className="truncate text-sm font-medium">{slice.label}</span>
              </div>

              {/* Value + percentage */}
              <div className="flex shrink-0 items-center gap-2 text-right">
                <span className="text-sm font-semibold tabular-nums">
                  {formatINR(slice.value)}
                </span>
                <span className="w-10 text-xs text-muted-foreground tabular-nums">
                  {slice.percentage.toFixed(1)}%
                </span>
              </div>
            </div>

            {/* Progress bar */}
            <div
              className="h-1 w-full overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuenow={Math.round(slice.percentage)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${slice.label} ${slice.percentage.toFixed(1)}%`}
            >
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${slice.percentage}%`,
                  backgroundColor: slice.color,
                }}
              />
            </div>
          </li>
        )
      })}
    </ul>
  )
}