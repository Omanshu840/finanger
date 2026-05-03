import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TrendingDown, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select'
import type { Asset, AssetType } from '@/features/investments/types/asset.types'
import { ASSET_TYPE_ORDER } from './assetConfig'
import { AssetGroup } from './components/AssetGroup'
import { formatINR } from '@/lib/currency'
import { AddAssetDrawer, EditAssetDrawer } from './AddAssetDrawer'
import { useAssets } from '@/store/selectors'
import { getAssetValuation, getPortfolioValuation } from './assetValuation'

const ASSET_SORT_OPTIONS = [
	{ value: 'current-desc', label: 'Current value high to low' },
	{ value: 'current-asc', label: 'Current value low to high' },
	{ value: 'invested-desc', label: 'Invested value high to low' },
	{ value: 'pnl-desc', label: 'Profit high to low' },
	{ value: 'pnl-asc', label: 'Profit low to high' },
	{ value: 'return-desc', label: 'Return high to low' },
	{ value: 'return-asc', label: 'Return low to high' },
	{ value: 'name-asc', label: 'Name A to Z' },
] as const

type AssetSortKey = typeof ASSET_SORT_OPTIONS[number]['value']

export function AssetsPage() {
	const assets = useAssets()
	const navigate = useNavigate()

	const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
	const [sortBy, setSortBy] = useState<AssetSortKey>('current-desc')

	// Group assets by type, preserving display order
	const grouped = useMemo(() => {
		const map = new Map<AssetType, Asset[]>()
		for (const type of ASSET_TYPE_ORDER) map.set(type, [])
		for (const asset of assets) {
			map.get(asset.type)?.push(asset)
		}
		for (const [type, typeAssets] of map) {
			map.set(type, sortAssets(typeAssets, sortBy))
		}
		return map
	}, [assets, sortBy])

	const valuation = useMemo(() => getPortfolioValuation(assets), [assets])
	const pnlPositive = valuation.profitLoss >= 0

	const assetCount = assets.length

	return (
		// relative + pb-20 gives the FAB clearance at the bottom
		<div className="relative min-w-0 space-y-5 pb-20">

			{/* ── Summary strip ── */}
			<div className="min-w-0 rounded-xl border border-border/60 bg-card px-4 py-4 shadow-sm">
				<div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
					<div className="min-w-0">
						<p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
							Portfolio value
						</p>
						<p className="mt-1 truncate text-3xl font-bold tabular-nums tracking-tight">
							{formatINR(valuation.currentValue)}
						</p>
						<p className="mt-0.5 text-xs text-muted-foreground">
							{assetCount} asset{assetCount !== 1 ? 's' : ''} tracked
						</p>
					</div>

					{valuation.hasInvestmentData && (
						<div
							className={cn(
								'w-fit max-w-full rounded-xl px-3 py-2 text-left sm:text-right',
								pnlPositive
									? 'bg-emerald-500/10 text-emerald-600'
									: 'bg-rose-500/10 text-rose-600',
							)}
						>
							<div className="flex min-w-0 items-center gap-1 text-sm font-semibold tabular-nums sm:justify-end">
								{pnlPositive
									? <TrendingUp className="h-4 w-4" aria-hidden="true" />
									: <TrendingDown className="h-4 w-4" aria-hidden="true" />}
								<span className="min-w-0 truncate">
									{pnlPositive ? '+' : '-'}{formatINR(Math.abs(valuation.profitLoss))}
								</span>
							</div>
							<p className="mt-0.5 text-xs font-medium tabular-nums">
								{pnlPositive ? '+' : ''}{valuation.profitLossPercent.toFixed(2)}%
							</p>
						</div>
					)}
				</div>

				{valuation.hasInvestmentData && (
					<div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
						<SummaryMetric label="Buy value" value={formatINR(valuation.investedAmount)} />
						<SummaryMetric label="Current value" value={formatINR(valuation.currentValue)} />
					</div>
				)}
			</div>

			<div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
					Holdings
				</p>
				<div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-2 sm:flex">
					<Button
						size="sm"
						variant="outline"
						onClick={() => navigate('/investments/import')}
					>
						Import
					</Button>
					<Select value={sortBy} onValueChange={(value) => setSortBy(value as AssetSortKey)}>
						<SelectTrigger
							size="sm"
							aria-label="Sort assets"
							className="w-full min-w-0 text-xs sm:w-[230px]"
						>
							<SelectValue />
						</SelectTrigger>
						<SelectContent align="end">
							{ASSET_SORT_OPTIONS.map((option) => (
								<SelectItem key={option.value} value={option.value}>
									{option.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
			</div>

			{/* ── Grouped asset lists ── */}
			{ASSET_TYPE_ORDER.map((type) => (
				<AssetGroup
					key={type}
					type={type}
					assets={grouped.get(type) ?? []}
					onAssetPress={(asset) => setEditingAsset(asset)}
				/>
			))}

			{/* ── Empty state — shown when no assets at all ── */}
			{assetCount === 0 && (
				<div className="flex flex-col items-center gap-3 py-16 text-center">
					<span className="text-4xl" aria-hidden="true">📊</span>
					<p className="font-medium">No assets yet</p>
					<p className="max-w-[22ch] text-sm text-muted-foreground">
						Tap the + button below to add your first asset
					</p>
				</div>
			)}

			{/* ── Floating Action Button ── */}
			<AddAssetDrawer />

			{editingAsset && (
				<EditAssetDrawer
					asset={editingAsset}
					open={Boolean(editingAsset)}
					onOpenChange={(open) => !open && setEditingAsset(null)}
				/>
			)}
		</div>
	)
}

function sortAssets(assets: Asset[], sortBy: AssetSortKey) {
	return [...assets].sort((a, b) => {
		const aValuation = getAssetValuation(a)
		const bValuation = getAssetValuation(b)
		const byName = a.name.localeCompare(b.name)

		switch (sortBy) {
			case 'current-asc':
				return aValuation.currentValue - bValuation.currentValue || byName
			case 'invested-desc':
				return (bValuation.investedAmount ?? 0) - (aValuation.investedAmount ?? 0) || byName
			case 'pnl-desc':
				return (bValuation.profitLoss ?? Number.NEGATIVE_INFINITY) - (aValuation.profitLoss ?? Number.NEGATIVE_INFINITY) || byName
			case 'pnl-asc':
				return (aValuation.profitLoss ?? Number.POSITIVE_INFINITY) - (bValuation.profitLoss ?? Number.POSITIVE_INFINITY) || byName
			case 'return-desc':
				return (bValuation.profitLossPercent ?? Number.NEGATIVE_INFINITY) - (aValuation.profitLossPercent ?? Number.NEGATIVE_INFINITY) || byName
			case 'return-asc':
				return (aValuation.profitLossPercent ?? Number.POSITIVE_INFINITY) - (bValuation.profitLossPercent ?? Number.POSITIVE_INFINITY) || byName
			case 'name-asc':
				return byName
			case 'current-desc':
			default:
				return bValuation.currentValue - aValuation.currentValue || byName
		}
	})
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
	return (
		<div className="rounded-lg bg-muted/45 px-3 py-2">
			<p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
				{label}
			</p>
			<p className="mt-1 text-sm font-semibold tabular-nums">{value}</p>
		</div>
	)
}
