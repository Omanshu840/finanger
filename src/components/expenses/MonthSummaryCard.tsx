import { Card, CardContent } from '@/components/ui/card'
import { formatCurrency } from '@/lib/currency'
import { TrendingUp, Receipt, Wallet } from 'lucide-react'

interface MonthSummaryCardProps {
  totalAmount: number
  expenseCount: number
  topCategory?: {
    name: string
    amount: number
    color: string
  }
  currency?: string
  locale?: string
}

export default function MonthSummaryCard({
  totalAmount,
  expenseCount,
  topCategory,
  currency = 'USD',
  locale = 'en-US'
}: MonthSummaryCardProps) {
  return (
    <Card className="border-2">
      <CardContent className="p-6">
        <div className="space-y-4">
          {/* Total Amount */}
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Wallet className="h-4 w-4" />
              <span>Total Expenses</span>
            </div>
            <p className="text-3xl font-bold">
              {formatCurrency(totalAmount, currency, locale)}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2 border-t">
            {/* Transaction Count */}
            <div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <Receipt className="h-3 w-3" />
                <span>Transactions</span>
              </div>
              <p className="text-xl font-semibold">{expenseCount}</p>
            </div>

            {/* Top Category */}
            {topCategory && (
              <div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                  <TrendingUp className="h-3 w-3" />
                  <span>Top Category</span>
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: topCategory.color }}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {topCategory.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(topCategory.amount, currency, locale)}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
