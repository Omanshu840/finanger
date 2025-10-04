import { Card, CardContent } from '@/components/ui/card'
// import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/currency'
import { cn } from '@/lib/utils'
import { Receipt } from 'lucide-react'

interface CategoryCardProps {
  categoryId: string
  categoryName: string
  categoryColor: string
  totalAmount: number
  expenseCount: number
  hasSplitwise?: boolean
  currency?: string
  locale?: string
  onClick: () => void
}

export default function CategoryCard({
  categoryName,
  categoryColor,
  totalAmount,
  expenseCount,
//   hasSplitwise = false,
  currency = 'INR',
  locale = 'en-US',
  onClick
}: CategoryCardProps) {
  const getRgbFromHex = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16)
        }
      : { r: 107, g: 114, b: 128 }
  }

  const rgb = getRgbFromHex(categoryColor)
  const backgroundColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.1)`
  const borderColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.3)`

  return (
    <Card
      className={cn(
        'cursor-pointer transition-all hover:shadow-md active:scale-95 py-0',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 py-0'
      )}
      style={{
        backgroundColor,
        borderColor
      }}
      onClick={onClick}
      tabIndex={0}
      role="button"
      aria-label={`View ${categoryName} expenses: ${formatCurrency(totalAmount, currency, locale)}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
    >
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between">
          <div className="text-xs line-clamp-1" title={categoryName}>
            {categoryName}
          </div>

          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Receipt className="h-3 w-3" />
            <span>{expenseCount}</span>
            {/* {hasSplitwise && (
              <Badge 
                variant="secondary" 
                className="ml-1 px-1 py-0 h-4 text-[10px] bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20"
              >
                SW
              </Badge>
            )} */}
          </div>
        </div>

        <div>
          <p className="text-lg font-bold mt-1">
            {formatCurrency(totalAmount, currency, locale)}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}