import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { CalendarIcon } from 'lucide-react'
import { format, isToday } from 'date-fns'

interface SplitwiseDatePickerProps {
  date: Date
  onDateChange: (date: Date) => void
}

export function SplitwiseDatePicker({ date, onDateChange }: SplitwiseDatePickerProps) {
  return (
    <div className="space-y-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-start h-11 font-normal"
          >
            <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
            {isToday(date) ? (
              <span>Today, {format(date, 'MMM d')}</span>
            ) : (
              <span>{format(date, 'PPP')}</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={(d) => d && onDateChange(d)}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}
