import { Card, CardContent } from '@/components/ui/card'
import { formatINR } from '@/lib/currency'
import { formatRelativeTime } from '@/lib/date'

interface NetWorthCardProps {
  netWorth: number
  assetCount: number
  lastUpdated: number | null
}

export function NetWorthCard({ netWorth, assetCount, lastUpdated }: NetWorthCardProps) {
  return (
    <Card className="border-border/50 bg-primary text-primary-foreground shadow-md">
      <CardContent className="px-5 py-6">
        <p className="text-sm font-medium opacity-80">Total Net Worth</p>

        {/* Main number — tabular-nums prevents width jitter on price updates */}
        <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight sm:text-4xl">
          {formatINR(netWorth)}
        </p>

        {/* Meta row */}
        <div className="mt-3 flex min-w-0 items-center justify-between gap-3">
          <span className="shrink-0 text-xs opacity-70">
            {assetCount} asset{assetCount !== 1 ? 's' : ''}
          </span>
          {lastUpdated != null && (
            <span className="min-w-0 truncate text-right text-xs opacity-70">
              Updated {formatRelativeTime(lastUpdated)}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
