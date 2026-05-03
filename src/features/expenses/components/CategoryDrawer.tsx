import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from '@/components/ui/drawer'
import { Badge } from '@/components/ui/badge'
import { type NormalizedSplitwiseExpense } from '@/features/expenses/api/splitwiseExpenses'
import { formatCurrency } from '@/lib/currency'
import { FileText, CheckCircle2, Circle } from 'lucide-react'
import { format } from 'date-fns'

interface CategoryDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  categoryName: string
  categoryColor: string
  totalAmount: number
  splitwiseItems?: NormalizedSplitwiseExpense[]
  currency?: string
  locale?: string
}

export default function CategoryDrawer({
  open,
  onOpenChange,
  categoryName,
  categoryColor,
  totalAmount,
  splitwiseItems = [],
  currency = 'INR',
  locale = 'en-US',
}: CategoryDrawerProps) {

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="h-[85vh] md:max-w-md md:ml-auto">
        <DrawerHeader className="border-b">
          <div className="flex items-center gap-3">
            <div
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: categoryColor }}
            />
            <div className="flex-1">
              <DrawerTitle>{categoryName}</DrawerTitle>
              <DrawerDescription>
                {formatCurrency(totalAmount, currency, locale)} • {splitwiseItems.length} expenses
              </DrawerDescription>
            </div>
          </div>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {splitwiseItems.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">
                No expenses in this category for this month
              </p>
            </div>
          ) : (
            <>
              {splitwiseItems.map((expense) => (
                <div
                  key={`splitwise-${expense.id}`}
                  className="border rounded-lg p-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge 
                          variant="outline" 
                          className="text-[10px] px-1.5 py-0 h-5 bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30"
                        >
                          Splitwise
                        </Badge>
                        
                        {expense.settled ? (
                          <CheckCircle2 className="h-3 w-3 text-green-600 dark:text-green-400" />
                        ) : (
                          <Circle className="h-3 w-3 text-orange-600 dark:text-orange-400" />
                        )}
                      </div>

                      <p className="text-sm font-medium">
                        {expense.description}
                      </p>

                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                        <span>{format(new Date(expense.date), 'MMM dd, yyyy')}</span>
                        <span>•</span>
                        <span>{expense.group_name}</span>
                      </div>

                    </div>

                    <div className="flex items-center gap-1">
                      <div className="text-right">
                        <p className="font-semibold text-sm">
                          {formatCurrency(expense.user_owed_share, expense.currency, locale)}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {expense.settled ? 'Settled' : 'Unsettled'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  )
}
