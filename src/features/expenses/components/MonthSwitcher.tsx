import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { isMonthInFuture } from '@/lib/date'
import MonthSummaryCard from './MonthSummaryCard'

interface MonthSwitcherProps {
  currentMonth: Date
  onMonthChange: (date: Date) => void
  onNavigate: (direction: 'prev' | 'next') => void,
  totalAmount: number
  expenseCount: number,
  topCategory?: {
    name: string
    amount: number
    color: string
  },
}

export default function MonthSwitcher({
  currentMonth,
  onNavigate,
  totalAmount,
  expenseCount,
  topCategory
}: MonthSwitcherProps) {
  const isNextDisabled = isMonthInFuture(currentMonth)

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="icon"
        onClick={() => onNavigate('prev')}
        aria-label="Previous month"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <div className="flex items-center gap-2 min-w-[180px] justify-center">
        <MonthSummaryCard
            totalAmount={totalAmount}
            expenseCount={expenseCount}
            topCategory={topCategory}
            currentMonth={currentMonth}
        />
      </div>

      <Button
        variant="outline"
        size="icon"
        onClick={() => onNavigate('next')}
        disabled={isNextDisabled}
        aria-label="Next month"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  )
}
