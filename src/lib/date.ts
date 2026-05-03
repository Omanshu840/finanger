import { 
  startOfMonth, 
  endOfMonth, 
  addMonths, 
  subMonths, 
  format, 
  isAfter,
  parseISO,
  isValid
} from 'date-fns'

/**
 * Get start and end dates for a given month
 */
export function getMonthBounds(date: Date) {
  return {
    start: startOfMonth(date),
    end: endOfMonth(date)
  }
}

/**
 * Format month for display (e.g., "October 2025")
 */
export function formatMonthLabel(date: Date): string {
  return format(date, 'MMMM yyyy')
}

/**
 * Format month for URL (YYYY-MM)
 */
export function formatMonthKey(date: Date): string {
  return format(date, 'yyyy-MM')
}

/**
 * Parse month key from URL (YYYY-MM) to Date
 */
export function parseMonthKey(monthKey: string): Date | null {
  try {
    const parsed = parseISO(`${monthKey}-01`)
    return isValid(parsed) ? parsed : null
  } catch {
    return null
  }
}

/**
 * Check if a month is in the future
 */
export function isMonthInFuture(date: Date): boolean {
  const today = new Date()
  return isAfter(startOfMonth(date), startOfMonth(today))
}

/**
 * Navigate to previous/next month
 */
export function navigateMonth(date: Date, direction: 'prev' | 'next'): Date {
  return direction === 'next' ? addMonths(date, 1) : subMonths(date, 1)
}

/**
 * Get SQL-formatted date strings for month range
 */
export function getMonthRange(date: Date) {
  const { start, end } = getMonthBounds(date)
  return {
    startDate: format(start, 'yyyy-MM-dd'),
    endDate: format(end, 'yyyy-MM-dd')
  }
}

/**
 * Format a timestamp as a short relative label.
 */
export function formatRelativeTime(timestamp: number): string {
  const diff = Math.floor((Date.now() - timestamp) / 1000)

  if (diff < 10) return 'just now'
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`

  return new Date(timestamp).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
  })
}
