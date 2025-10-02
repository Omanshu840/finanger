import { Card, CardContent } from '@/components/ui/card'
import { formatCurrency } from '@/lib/currency'
import { cn } from '@/lib/utils'
import { Receipt } from 'lucide-react'

interface CategoryCardProps {
  categoryId: string
  categoryName: string
  categoryColor: string
  totalAmount: number
  expenseCount: number
  currency?: string
  locale?: string
  onClick: () => void
}

export default function CategoryCard({
  categoryName,
  categoryColor,
  totalAmount,
  expenseCount,
  currency = 'USD',
  locale = 'en-US',
  onClick
}: CategoryCardProps) {
  // Convert hex color to RGB for opacity
  const getRgbFromHex = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16)
        }
      : { r: 107, g: 114, b: 128 } // fallback to muted
  }

  const rgb = getRgbFromHex(categoryColor)
  const backgroundColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.1)`
  const borderColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.3)`

  return (
    <Card
      className={cn(
        'cursor-pointer transition-all hover:shadow-md active:scale-95',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
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
          <div
            className="w-3 h-3 rounded-full mt-1"
            style={{ backgroundColor: categoryColor }}
          />
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Receipt className="h-3 w-3" />
            <span>{expenseCount}</span>
          </div>
        </div>

        <div>
          <h3 className="font-semibold text-sm line-clamp-1" title={categoryName}>
            {categoryName}
          </h3>
          <p className="text-xl font-bold mt-1">
            {formatCurrency(totalAmount, currency, locale)}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
