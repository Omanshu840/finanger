import type { Asset, AssetType } from '@/features/investments/types/asset.types'

type LegacyCostAsset = Asset & {
  avgCost?: number
  averageCost?: number
  investedAmount?: number
  investedValue?: number
}

export interface AssetValuation {
  quantity: number | null
  buyPrice: number | null
  investedAmount: number | null
  currentValue: number
  currentUnitPrice: number | null
  profitLoss: number | null
  profitLossPercent: number | null
  hasInvestmentData: boolean
}

export interface PortfolioValuation {
  currentValue: number
  investedAmount: number
  profitLoss: number
  profitLossPercent: number
  hasInvestmentData: boolean
}

export function getAssetValuation(asset: Asset): AssetValuation {
  const legacyAsset = asset as LegacyCostAsset
  const quantity = asset.quantity != null && asset.quantity > 0 ? asset.quantity : null
  const buyPrice =
    asset.buyPrice != null && asset.buyPrice > 0
      ? asset.buyPrice
      : legacyAsset.avgCost != null && legacyAsset.avgCost > 0
        ? legacyAsset.avgCost
        : legacyAsset.averageCost != null && legacyAsset.averageCost > 0
          ? legacyAsset.averageCost
          : null
  const currentValue = asset.value ?? 0
  const legacyInvestedAmount =
    legacyAsset.investedAmount != null && legacyAsset.investedAmount > 0
      ? legacyAsset.investedAmount
      : legacyAsset.investedValue != null && legacyAsset.investedValue > 0
        ? legacyAsset.investedValue
        : null
  const investedAmount =
    quantity != null && buyPrice != null
      ? quantity * buyPrice
      : legacyInvestedAmount
  const currentUnitPrice = quantity != null && currentValue > 0 ? currentValue / quantity : null
  const profitLoss = investedAmount != null ? currentValue - investedAmount : null
  const profitLossPercent =
    investedAmount != null && investedAmount > 0 && profitLoss != null
      ? (profitLoss / investedAmount) * 100
      : null

  return {
    quantity,
    buyPrice,
    investedAmount,
    currentValue,
    currentUnitPrice,
    profitLoss,
    profitLossPercent,
    hasInvestmentData: investedAmount != null,
  }
}

export function getPortfolioValuation(assets: Asset[]): PortfolioValuation {
  return assets.reduce<PortfolioValuation>(
    (summary, asset) => {
      const valuation = getAssetValuation(asset)

      summary.currentValue += valuation.currentValue

      if (valuation.investedAmount != null && valuation.profitLoss != null) {
        summary.investedAmount += valuation.investedAmount
        summary.profitLoss += valuation.profitLoss
        summary.hasInvestmentData = true
      }

      summary.profitLossPercent =
        summary.investedAmount > 0 ? (summary.profitLoss / summary.investedAmount) * 100 : 0

      return summary
    },
    {
      currentValue: 0,
      investedAmount: 0,
      profitLoss: 0,
      profitLossPercent: 0,
      hasInvestmentData: false,
    },
  )
}

export function getAssetTypeValuations(assets: Asset[]) {
  const map = new Map<AssetType, PortfolioValuation>()

  for (const asset of assets) {
    const existing =
      map.get(asset.type) ??
      {
        currentValue: 0,
        investedAmount: 0,
        profitLoss: 0,
        profitLossPercent: 0,
        hasInvestmentData: false,
      }

    const valuation = getAssetValuation(asset)
    existing.currentValue += valuation.currentValue

    if (valuation.investedAmount != null && valuation.profitLoss != null) {
      existing.investedAmount += valuation.investedAmount
      existing.profitLoss += valuation.profitLoss
      existing.hasInvestmentData = true
    }

    existing.profitLossPercent =
      existing.investedAmount > 0 ? (existing.profitLoss / existing.investedAmount) * 100 : 0

    map.set(asset.type, existing)
  }

  return map
}
