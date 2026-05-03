import { cn } from '@/lib/utils'
import type { Asset, AssetType } from '@/features/investments/types/asset.types'
import { ASSET_TYPE_CONFIG } from '../assetConfig'
import { AssetCard } from './AssetCard'
import { formatINR } from '@/lib/currency'
import { getPortfolioValuation } from '../assetValuation'

interface AssetGroupProps {
  type: AssetType
  assets: Asset[]
  onAssetPress?: (asset: Asset) => void
}

export function AssetGroup({ type, assets, onAssetPress }: AssetGroupProps) {
  if (assets.length === 0) return null

  const config = ASSET_TYPE_CONFIG[type]
  const valuation = getPortfolioValuation(assets)
  const pnlPositive = valuation.profitLoss >= 0

  return (
    <section aria-labelledby={`group-${type}`}>
      {/* Group header */}
      <div className="mb-2 flex items-center justify-between">
        <h2
          id={`group-${type}`}
          className={cn(
            'text-xs font-semibold uppercase tracking-widest',
            'text-muted-foreground',
          )}
        >
          {config.label}
        </h2>
        <div className="text-right">
          <span className="block text-xs font-medium tabular-nums text-muted-foreground">
            {formatINR(valuation.currentValue)}
          </span>
          {valuation.hasInvestmentData && (
            <span
              className={cn(
                'block text-[11px] font-medium tabular-nums',
                pnlPositive ? 'text-emerald-600' : 'text-rose-600',
              )}
            >
              {pnlPositive ? '+' : '-'}{formatINR(Math.abs(valuation.profitLoss))}
              {' '}
              ({pnlPositive ? '+' : ''}{valuation.profitLossPercent.toFixed(2)}%)
            </span>
          )}
        </div>
      </div>

      {/* Asset cards — stacked with divider between, no outer gap */}
      <div
        className={cn(
          'overflow-hidden rounded-xl',
          'border border-border/50',
          'divide-y divide-border/50',
        )}
      >
        {assets.map((asset) => (
          <AssetCard
            key={asset.id}
            asset={asset}
            onPress={onAssetPress}
          />
        ))}
      </div>
    </section>
  )
}
