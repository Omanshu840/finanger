interface Transaction {
  id: string
  type: 'buy' | 'sell' | 'dividend' | 'fee' | 'interest' | 'split'
  asset_id: string
  quantity: number | null
  price: number | null
  fee: number
  trade_date: string
  created_at: string
}

interface Lot {
  quantity: number
  cost_per_unit: number
  purchase_date: string
  transaction_id: string
}

interface AssetPosition {
  asset_id: string
  symbol: string
  name: string
  quantity: number
  avg_cost: number
  cost_basis: number
  realized_pnl: number // Placeholder for future
  lots: Lot[]
}

export interface Holding {
  asset_id: string
  symbol: string
  name: string
  quantity: number
  avg_cost: number
  cost_basis: number
  realized_pnl: number
}

/**
 * Compute holdings from transactions using FIFO (First In, First Out)
 */
export function computeHoldings(
  transactions: Transaction[],
  assets: Map<string, { symbol: string; name: string }>
): Holding[] {
  const positions = new Map<string, AssetPosition>()

  // Sort transactions by date (trade_date, then created_at as tie-breaker)
  const sortedTx = [...transactions].sort((a, b) => {
    const dateCompare = new Date(a.trade_date).getTime() - new Date(b.trade_date).getTime()
    if (dateCompare !== 0) return dateCompare
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  })

  for (const tx of sortedTx) {
    if (!tx.asset_id) continue

    // Get or create position
    let position = positions.get(tx.asset_id)
    if (!position) {
      const asset = assets.get(tx.asset_id)
      if (!asset) continue

      position = {
        asset_id: tx.asset_id,
        symbol: asset.symbol,
        name: asset.name,
        quantity: 0,
        avg_cost: 0,
        cost_basis: 0,
        realized_pnl: 0,
        lots: []
      }
      positions.set(tx.asset_id, position)
    }

    switch (tx.type) {
      case 'buy':
        handleBuy(position, tx)
        break
      case 'sell':
        handleSell(position, tx)
        break
      case 'split':
        handleSplit(position, tx)
        break
      // dividend, fee, interest don't affect quantity
      default:
        break
    }
  }

  // Convert positions to holdings
  return Array.from(positions.values())
    .filter(p => p.quantity > 0) // Only show open positions
    .map(p => ({
      asset_id: p.asset_id,
      symbol: p.symbol,
      name: p.name,
      quantity: p.quantity,
      avg_cost: p.avg_cost,
      cost_basis: p.cost_basis,
      realized_pnl: p.realized_pnl
    }))
}

/**
 * Handle buy transaction - add new lot
 */
function handleBuy(position: AssetPosition, tx: Transaction) {
  const quantity = tx.quantity || 0
  const price = tx.price || 0
  const fee = tx.fee || 0

  // Cost per unit includes proportional fee
  const costPerUnit = price + (fee / quantity)

  // Add new lot
  position.lots.push({
    quantity,
    cost_per_unit: costPerUnit,
    purchase_date: tx.trade_date,
    transaction_id: tx.id
  })

  // Update totals
  position.quantity += quantity
  position.cost_basis += (quantity * costPerUnit)
  position.avg_cost = position.cost_basis / position.quantity
}

/**
 * Handle sell transaction - consume lots using FIFO
 */
function handleSell(position: AssetPosition, tx: Transaction) {
  let remainingToSell = tx.quantity || 0
  const sellPrice = tx.price || 0
  const fee = tx.fee || 0

  let totalCost = 0

  // Consume lots in FIFO order
  while (remainingToSell > 0 && position.lots.length > 0) {
    const lot = position.lots[0]

    if (lot.quantity <= remainingToSell) {
      // Consume entire lot
      totalCost += lot.quantity * lot.cost_per_unit
      remainingToSell -= lot.quantity
      position.lots.shift() // Remove consumed lot
    } else {
      // Partially consume lot
      totalCost += remainingToSell * lot.cost_per_unit
      lot.quantity -= remainingToSell
      remainingToSell = 0
    }
  }

  const soldQuantity = (tx.quantity || 0) - remainingToSell
  const proceeds = (soldQuantity * sellPrice) - fee

  // Update totals
  position.quantity -= soldQuantity
  position.cost_basis -= totalCost
  
  if (position.quantity > 0) {
    position.avg_cost = position.cost_basis / position.quantity
  } else {
    position.avg_cost = 0
  }

  // Track realized P&L (for future use)
  position.realized_pnl += (proceeds - totalCost)
}

/**
 * Handle stock split - adjust all lots
 */
function handleSplit(position: AssetPosition, tx: Transaction) {
  const splitRatio = tx.quantity || 1 // e.g., 2 for 2:1 split

  // Adjust all lots
  for (const lot of position.lots) {
    lot.quantity *= splitRatio
    lot.cost_per_unit /= splitRatio
  }

  // Update totals
  position.quantity *= splitRatio
  // Cost basis stays the same, avg_cost is recalculated
  position.avg_cost = position.cost_basis / position.quantity
}

/**
 * Compute total invested amount (sum of buys - sells + fees)
 */
export function computeInvestedAmount(transactions: Transaction[]): number {
  let invested = 0

  for (const tx of transactions) {
    const quantity = tx.quantity || 0
    const price = tx.price || 0
    const amount = tx.amount || 0
    const fee = tx.fee || 0

    switch (tx.type) {
      case 'buy':
        invested += (quantity * price) + fee
        break
      case 'sell':
        invested -= (quantity * price) - fee
        break
      case 'fee':
        invested += amount || fee
        break
      default:
        break
    }
  }

  return invested
}
