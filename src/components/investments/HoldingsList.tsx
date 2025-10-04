import { formatCurrency } from '@/lib/currency'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TrendingUp } from 'lucide-react'
import type { HoldingWithPrice } from '@/lib/liveValuation'
import { cn } from '@/lib/utils'

interface HoldingsListProps {
  holdings: HoldingWithPrice[]
  onHoldingClick?: (assetId: string) => void
  currency?: string
  locale?: string
  showPrices?: boolean
}

export default function HoldingsList({
  holdings,
  onHoldingClick,
  currency = 'INR',
  locale = 'en-IN',
  showPrices = false
}: HoldingsListProps) {
  if (holdings.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <TrendingUp className="mx-auto h-12 w-12 mb-4 opacity-50" />
        <p>No holdings yet</p>
      </div>
    )
  }

  return (
    <>
      {/* Mobile: Card Layout */}
      <div className="md:hidden space-y-3">
        {holdings.map((holding) => (
          <Card
            key={holding.asset_id}
            className="cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => onHoldingClick?.(holding.asset_id)}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{holding.symbol}</p>
                  <p className="text-xs text-muted-foreground truncate">{holding.name}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Quantity</p>
                  <p className="font-medium">{holding.quantity.toFixed(3)}</p>
                </div>
                
                {showPrices && holding.currentPrice && (
                  <div>
                    <p className="text-xs text-muted-foreground">Price</p>
                    <p className="font-medium">{formatCurrency(holding.currentPrice, currency, locale)}</p>
                  </div>
                )}
                
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">
                    {showPrices ? 'Value' : 'Cost Basis'}
                  </p>
                  <p className="font-semibold">
                    {formatCurrency(
                      showPrices && holding.marketValue ? holding.marketValue : holding.costBasis,
                      currency,
                      locale
                    )}
                  </p>
                </div>
              </div>

              {showPrices && holding.unrealizedPnL != null && (
                <div className="mt-2 pt-2 border-t flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">P&L:</span>
                  <span className={cn(
                    "text-sm font-semibold",
                    holding.unrealizedPnL >= 0 ? "text-green-600" : "text-red-600"
                  )}>
                    {formatCurrency(holding.unrealizedPnL, currency, locale)} 
                    ({holding.unrealizedPnLPct?.toFixed(2)}%)
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Desktop: Table Layout */}
      <div className="hidden md:block rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Symbol</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="text-right">Quantity</TableHead>
              {showPrices && <TableHead className="text-right">Price</TableHead>}
              <TableHead className="text-right">
                {showPrices ? 'Market Value' : 'Cost Basis'}
              </TableHead>
              {showPrices && <TableHead className="text-right">P&L</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {holdings.map((holding) => (
              <TableRow
                key={holding.asset_id}
                className="cursor-pointer"
                onClick={() => onHoldingClick?.(holding.asset_id)}
              >
                <TableCell className="font-medium">{holding.symbol}</TableCell>
                <TableCell className="max-w-xs truncate">{holding.name}</TableCell>
                <TableCell className="text-right">{holding.quantity.toFixed(3)}</TableCell>
                
                {showPrices && (
                  <TableCell className="text-right">
                    {holding.currentPrice 
                      ? formatCurrency(holding.currentPrice, currency, locale)
                      : '-'
                    }
                  </TableCell>
                )}
                
                <TableCell className="text-right font-semibold">
                  {formatCurrency(
                    showPrices && holding.marketValue ? holding.marketValue : holding.costBasis,
                    currency,
                    locale
                  )}
                </TableCell>

                {showPrices && (
                  <TableCell className="text-right">
                    {holding.unrealizedPnL != null ? (
                      <span className={cn(
                        "font-semibold",
                        holding.unrealizedPnL >= 0 ? "text-green-600" : "text-red-600"
                      )}>
                        {formatCurrency(holding.unrealizedPnL, currency, locale)}
                        <br />
                        <span className="text-xs">
                          ({holding.unrealizedPnLPct?.toFixed(2)}%)
                        </span>
                      </span>
                    ) : '-'}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  )
}
