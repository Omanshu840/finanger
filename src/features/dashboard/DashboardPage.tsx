import { useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { NetWorthCard }       from './widgets/NetWorthCard'
import { AllocationDonut }    from './widgets/AllocationDonut'
import { AllocationBreakdown } from './widgets/AllocationBreakdown'
import { useNetWorthSummary } from './hooks/useNetWorthSummary'
import { AssetCard }          from '@/features/investments/assets/components/AssetCard'
import { useAssets }          from '@/store/selectors'
import { usePriceRefresh }    from '@/features/investments/pricing/hooks/usePriceRefresh'

export function DashboardPage() {

  // ── Data ─────────────────────────────────────────────────────────────────
  const rawAssets = useAssets()
  const { refresh } = usePriceRefresh()

  // Refresh prices on component mount
  useEffect(() => {
    void refresh()
  }, [])

  const { netWorth, allocation, assetCount, lastUpdated } = useNetWorthSummary()

  // Top 3 assets by value
  const assets = rawAssets
  const topAssets = useMemo(
    () => [...assets].sort((a, b) => (b.value ?? 0) - (a.value ?? 0)).slice(0, 3),
    [assets],
  )

  return (
    <div className="min-w-0 space-y-4 pb-4">

      {/* ── Net Worth ─────────────────────────────────────────────────── */}
      <NetWorthCard
        netWorth={netWorth}
        assetCount={assetCount}
        lastUpdated={lastUpdated}
      />

      {/* ── Allocation ───────────────────────────────────────────────── */}
      <Card className="border-border/50 shadow-none">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold">Allocation</CardTitle>
        </CardHeader>

        <CardContent className="min-w-0 px-4 pb-4">
          {allocation.length > 0 ? (
            <div className="grid min-w-0 grid-cols-1 items-center gap-4 sm:grid-cols-[1fr_1.2fr]">
              <AllocationDonut data={allocation} netWorth={netWorth} />
              <AllocationBreakdown allocation={allocation} />
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No assets yet
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Top Holdings ─────────────────────────────────────────────── */}
      <Card className="border-border/50 shadow-none">
        <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold">Top Holdings</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-xs text-muted-foreground"
            asChild
          >
            <Link to="/investments" aria-label="View all assets">
              View all
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </Button>
        </CardHeader>

        <CardContent className="p-0">
          <div className="divide-y divide-border/50">
            {topAssets.map((asset) => (
              <AssetCard key={asset.id} asset={asset} />
            ))}
          </div>
        </CardContent>
      </Card>

    </div>
  )
}
