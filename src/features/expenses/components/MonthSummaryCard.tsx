import { Card, CardContent } from '@/components/ui/card'
import { formatCurrency } from '@/lib/currency'
import { formatMonthLabel } from '@/lib/date'
import { Calendar } from 'lucide-react'

interface MonthSummaryCardProps {
  totalAmount: number
  expenseCount: number
  topCategory?: {
    name: string
    amount: number
    color: string
  }
  currency?: string
  locale?: string,
  currentMonth: Date
}

export default function MonthSummaryCard({
  totalAmount,
  currency = 'INR',
  locale = 'en-US',
  currentMonth
}: MonthSummaryCardProps) {
  return (
    <Card className="py-0 gap-0">
        <div className='flex items-center justify-center gap-2 pt-4 px-6'>
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground text-sm">
            {formatMonthLabel(currentMonth)}
            </span>
        </div>
      <CardContent className="p-6 pb-4 pt-2">
        <div className="space-y-4">
          {/* Total Amount */}
          <div className='text-center'>
            <p className="text-2xl font-bold">
              {formatCurrency(totalAmount, currency, locale)}
            </p>
            <div className="text-sm text-muted-foreground">
              Total Expenses
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
