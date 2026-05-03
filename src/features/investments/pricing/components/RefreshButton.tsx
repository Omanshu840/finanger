import { RefreshCw, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from '@/components/ui/tooltip'
import { usePriceRefresh } from '../hooks/usePriceRefresh'
import { useLastRefreshedAt } from '@/store/selectors'
import { formatRelativeTime } from '@/lib/date'
import { useState } from 'react'
import type { RefreshSummary } from '../hooks/usePriceRefresh'

export function RefreshButton() {
  const { refresh, isRefreshing } = usePriceRefresh()
  const lastRefreshedAt           = useLastRefreshedAt()
  const [summary, setSummary]     = useState<RefreshSummary | null>(null)

  async function handleRefresh() {
    const result = await refresh()
    if (result) setSummary(result)
  }

  const hasMissingMF    = (summary?.errors.mf.length ?? 0) > 0
  const hasStockErrors  = Object.keys(summary?.errors.stocks ?? {}).length > 0
  const hasAnyError     = hasMissingMF || hasStockErrors

  return (
    <div className="flex items-center gap-2">
      {/* Timestamp */}
      {lastRefreshedAt && (
        <span className="hidden text-xs text-muted-foreground tabular-nums sm:block">
          {formatRelativeTime(lastRefreshedAt)}
        </span>
      )}

      {/* Unresolved MF warning */}
      {hasMissingMF && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              aria-label={`${summary!.errors.mf.length} mutual fund${summary!.errors.mf.length > 1 ? 's' : ''} could not be valued`}
              className="flex items-center"
            >
              <AlertCircle className="h-3.5 w-3.5 text-amber-500" aria-hidden="true" />
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <p className="mb-1 font-medium">
              {summary!.errors.mf.length} fund{summary!.errors.mf.length > 1 ? 's' : ''} missing scheme code
            </p>
            <ul className="space-y-0.5 text-xs text-muted-foreground">
              {summary!.errors.mf.map((name) => (
                <li key={name} className="truncate">· {name}</li>
              ))}
            </ul>
          </TooltipContent>
        </Tooltip>
      )}

      {/* Summary chip — shown briefly after refresh */}
      {summary && !isRefreshing && (
        <span
          className={cn(
            'hidden text-xs tabular-nums sm:block',
            hasAnyError ? 'text-amber-600' : 'text-emerald-600',
          )}
          aria-live="polite"
        >
          {summary.stocksUpdated + summary.mfUpdated} updated
          {hasAnyError && ` · ${summary.errors.mf.length + Object.keys(summary.errors.stocks).length} failed`}
        </span>
      )}

      <Button
        variant="ghost"
        size="sm"
        onClick={handleRefresh}
        disabled={isRefreshing}
        aria-label={isRefreshing ? 'Refreshing prices…' : 'Refresh stock and mutual fund prices'}
        className="h-8 gap-1.5 px-2 text-xs"
      >
        <RefreshCw
          className={cn('h-3.5 w-3.5', isRefreshing && 'animate-spin')}
          aria-hidden="true"
        />
        {isRefreshing ? 'Refreshing…' : 'Refresh'}
      </Button>
    </div>
  )
}