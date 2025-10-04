import { useEffect, useState } from 'react'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter } from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { getExpensesByCategoryForMonth, deleteExpense, type ExpenseListItem } from '@/data/expenses'
import { type NormalizedSplitwiseExpense } from '@/data/splitwise'
import { deleteReceipt } from '@/lib/storage'
import { useSignedUrl } from '@/hooks/useSignedUrl'
import { formatCurrency } from '@/lib/currency'
import { mergeDrawerItems } from '@/lib/merge'
import { toast } from 'sonner'
import { Eye, MoreVertical, Edit, Trash, Loader2, Plus, FileText, CheckCircle2, Circle } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'

interface CategoryDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  categoryId: string | null
  categoryName: string
  categoryColor: string
  totalAmount: number
  monthStart: string
  monthEnd: string
  splitwiseItems?: NormalizedSplitwiseExpense[]
  currency?: string
  locale?: string
  onEdit?: (expenseId: string) => void
  onAddExpense?: (categoryId: string) => void
  onExpenseDeleted?: () => void
  refreshKey?: number
}

function ReceiptButton({ path }: { path: string | null }) {
  const { url, loading } = useSignedUrl(path)

  if (!path) return null

  return (
    <Button
      variant="ghost"
      size="icon"
      disabled={loading || !url}
      onClick={(e) => {
        e.stopPropagation()
        if (url) window.open(url, '_blank')
      }}
      title="View receipt"
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Eye className="h-4 w-4" />
      )}
    </Button>
  )
}

export default function CategoryDrawer({
  open,
  onOpenChange,
  categoryId,
  categoryName,
  categoryColor,
  totalAmount,
  monthStart,
  monthEnd,
  splitwiseItems = [],
  currency = 'INR',
  locale = 'en-US',
  onEdit,
  onAddExpense,
  onExpenseDeleted,
  refreshKey
}: CategoryDrawerProps) {
  const [localExpenses, setLocalExpenses] = useState<ExpenseListItem[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open && categoryId) {
      loadExpenses(1)
    } else {
      setLocalExpenses([])
    }
  }, [open, categoryId, monthStart, monthEnd, refreshKey])

  const loadExpenses = async (pageNum: number) => {
    // Skip loading if this is a virtual Splitwise-only category
    if (!categoryId || categoryId.startsWith('sw_')) {
      setLoading(false)
      return
    }

    setLoading(true)

    try {
      const result = await getExpensesByCategoryForMonth(
        categoryId,
        monthStart,
        monthEnd,
        pageNum
      )

      if (pageNum === 1) {
        setLocalExpenses(result.data)
      } else {
        setLocalExpenses(prev => [...prev, ...result.data])
      }
    } catch (error: any) {
      toast.error('Failed to load expenses', {
        description: error.message
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string, receiptPath?: string | null, source?: 'local' | 'splitwise') => {
    if (source === 'splitwise') {
      toast.info('Cannot delete Splitwise expenses from here', {
        description: 'Please use the Splitwise app to modify expenses'
      })
      return
    }

    try {
      if (receiptPath) {
        await deleteReceipt(receiptPath)
      }

      const { error } = await deleteExpense(id)
      
      if (error) throw new Error(error)

      toast.success('Expense deleted')
      loadExpenses(1)
      onExpenseDeleted?.()
    } catch (error: any) {
      toast.error('Failed to delete expense', {
        description: error.message
      })
    }
  }

  // Merge local and Splitwise items
  const mergedItems = mergeDrawerItems(localExpenses, splitwiseItems)

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
                {formatCurrency(totalAmount, currency, locale)} • {mergedItems.length} expenses
              </DrawerDescription>
            </div>
          </div>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading && localExpenses.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : mergedItems.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">
                No expenses in this category for this month
              </p>
              {onAddExpense && categoryId && !categoryId.startsWith('sw_') && (
                <Button onClick={() => onAddExpense(categoryId)} size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Expense
                </Button>
              )}
            </div>
          ) : (
            <>
              {mergedItems.map((expense) => (
                <div
                  key={`${expense.source}-${expense.id}`}
                  className="border rounded-lg p-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge 
                          variant="outline" 
                          className={cn(
                            "text-[10px] px-1.5 py-0 h-5",
                            expense.source === 'splitwise' 
                              ? "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30"
                              : "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30"
                          )}
                        >
                          {expense.source === 'splitwise' ? 'Splitwise' : 'Local'}
                        </Badge>
                        
                        {expense.source === 'splitwise' && (
                          expense.settled ? (
                            <CheckCircle2 className="h-3 w-3 text-green-600 dark:text-green-400" />
                          ) : (
                            <Circle className="h-3 w-3 text-orange-600 dark:text-orange-400" />
                          )
                        )}
                      </div>

                      <p className="text-sm font-medium">
                        {expense.description || expense.merchant || 'No description'}
                      </p>

                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                        <span>{format(new Date(expense.date), 'MMM dd, yyyy')}</span>
                        <span>•</span>
                        <span>
                          {expense.source === 'splitwise' 
                            ? expense.group_name 
                            : expense.account?.name
                          }
                        </span>
                      </div>

                      {expense.notes && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {expense.notes}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <div className="text-right">
                        <p className="font-semibold text-sm">
                            {expense.source === 'splitwise'
                            ? formatCurrency(expense.user_owed_share, expense.currency, locale)
                            : formatCurrency(expense.amount, expense.currency, locale)
                            }
                        </p>
                        {expense.source === 'splitwise' && (
                            <p className="text-[10px] text-muted-foreground">
                            {expense.settled ? 'Settled' : 'Unsettled'}
                            </p>
                        )}
                      </div>


                      {expense.source === 'local' && (
                        <>
                          {expense.receipt_path && (
                            <ReceiptButton path={expense.receipt_path} />
                          )}

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {onEdit && (
                                <DropdownMenuItem onClick={() => onEdit(expense.id)}>
                                  <Edit className="mr-2 h-4 w-4" />
                                  Edit
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                onClick={() => handleDelete(expense.id, expense.receipt_path, expense.source)}
                                className="text-destructive"
                              >
                                <Trash className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        {onAddExpense && categoryId && !categoryId.startsWith('sw_') && mergedItems.length > 0 && (
          <DrawerFooter className="border-t">
            <Button onClick={() => onAddExpense(categoryId)} className="w-full">
              <Plus className="mr-2 h-4 w-4" />
              Add Expense to {categoryName}
            </Button>
          </DrawerFooter>
        )}
      </DrawerContent>
    </Drawer>
  )
}
