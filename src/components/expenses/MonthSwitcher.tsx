import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react'
import { formatMonthLabel, isMonthInFuture } from '@/lib/date'

interface MonthSwitcherProps {
  currentMonth: Date
  onMonthChange: (date: Date) => void
  onNavigate: (direction: 'prev' | 'next') => void
}

export default function MonthSwitcher({
  currentMonth,
  onNavigate
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
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <span className="font-semibold">
          {formatMonthLabel(currentMonth)}
        </span>
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
