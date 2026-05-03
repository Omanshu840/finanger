import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { AlertCircle, TrendingUp, TrendingDown } from 'lucide-react'
import type { Asset } from '@/features/investments/types/asset.types'
import { formatINR } from '@/lib/currency'
import { getAssetValuation } from '../assetValuation'

interface AssetCardProps {
  asset:    Asset
  onPress?: (asset: Asset) => void
}

export function AssetCard({ asset, onPress }: AssetCardProps) {
  const isMF = asset.type === 'mf'
  const valuation = getAssetValuation(asset)

  // MF is "unresolved" if it has no value yet AND no schemeCode set
  const mfUnresolved = isMF && !asset.isin && !asset.schemeCode && asset.value == null
  const pnlPositive = (valuation.profitLoss ?? 0) >= 0
  const profitLoss = valuation.profitLoss ?? 0
  const profitLossPercent = valuation.profitLossPercent ?? 0

  return (
    <Card
      role="button"
      tabIndex={0}
      aria-label={`${asset.name}, current value ${formatINR(valuation.currentValue)}`}
      onClick={() => onPress?.(asset)}
      onKeyDown={(e) => e.key === 'Enter' && onPress?.(asset)}
      className={cn(
        'block px-3 py-2.5',
        'cursor-pointer select-none rounded-none border-0',
        'transition-colors duration-150',
        'active:bg-muted/60 hover:bg-muted/40',
        'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset',
        mfUnresolved && 'opacity-60',
      )}
    >
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-sm font-semibold leading-tight">{asset.name}</p>
            {mfUnresolved && (
              <AlertCircle
                className="h-3.5 w-3.5 shrink-0 text-amber-500"
                aria-label="Scheme code missing - add it to enable auto-valuation"
              />
            )}
          </div>
          {mfUnresolved && (
            <p className="mt-1 text-xs text-amber-600">Add scheme code to value</p>
          )}
        </div>

        {valuation.hasInvestmentData && (
          <ProfitBadge
            positive={pnlPositive}
            value={profitLoss}
            percent={profitLossPercent}
          />
        )}
      </div>

      <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-xs">
        <Metric
          label="Invested"
          value={valuation.investedAmount != null ? formatINR(valuation.investedAmount) : '-'}
        />
        <Metric label="Current" value={formatINR(valuation.currentValue)} />
        <Metric
          label="Net P/L"
          value={
            valuation.profitLoss != null
              ? `${pnlPositive ? '+' : '-'}${formatINR(Math.abs(profitLoss))}`
              : '-'
          }
          tone={valuation.profitLoss == null ? 'neutral' : pnlPositive ? 'positive' : 'negative'}
        />
        <Metric
          label="Return"
          value={
            valuation.profitLossPercent != null
              ? `${pnlPositive ? '+' : ''}${profitLossPercent.toFixed(2)}%`
              : '-'
          }
          tone={valuation.profitLossPercent == null ? 'neutral' : pnlPositive ? 'positive' : 'negative'}
        />
      </div>
    </Card>
  )
}

function Metric({
  label,
  value,
  tone = 'neutral',
}: {
  label: string
  value: string
  tone?: 'neutral' | 'positive' | 'negative'
}) {
  return (
    <span className="min-w-0">
      <span className="block text-[9px] font-medium uppercase leading-none text-muted-foreground">
        {label}
      </span>
      <span
        className={cn(
          'mt-1 block truncate text-[12px] font-semibold leading-none tabular-nums',
          tone === 'positive' && 'text-emerald-600',
          tone === 'negative' && 'text-rose-600',
        )}
      >
        {value}
      </span>
    </span>
  )
}

function ProfitBadge({
  positive,
  value,
  percent,
}: {
  positive: boolean
  value: number
  percent: number
}) {
  return (
    <span
      className={cn(
        'flex w-fit max-w-full shrink-0 items-center gap-1 rounded-full px-2 py-1',
        'text-xs font-semibold tabular-nums leading-none',
        positive
          ? 'bg-emerald-500/10 text-emerald-600'
          : 'bg-rose-500/10 text-rose-600',
      )}
      aria-label={`Net profit/loss ${positive ? 'gain' : 'loss'}`}
    >
      {positive
        ? <TrendingUp className="h-3 w-3" aria-hidden="true" />
        : <TrendingDown className="h-3 w-3" aria-hidden="true" />}
      <span className="min-w-0 truncate">
        {positive ? '+' : '-'}{formatINR(Math.abs(value))}
      </span>
      <span className="shrink-0 text-[11px] opacity-80">
        ({positive ? '+' : ''}{percent.toFixed(2)}%)
      </span>
    </span>
  )
}
