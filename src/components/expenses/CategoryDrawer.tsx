import { useEffect, useState } from 'react'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter } from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { getExpensesByCategoryForMonth, deleteExpense, type ExpenseListItem } from '@/data/expenses'
import { deleteReceipt } from '@/lib/storage'
import { useSignedUrl } from '@/hooks/useSignedUrl'
import { formatCurrency } from '@/lib/currency'
import { toast } from 'sonner'
import { Eye, MoreVertical, Edit, Trash, Loader2, Plus, FileText } from 'lucide-react'
import { format } from 'date-fns'

interface CategoryDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  categoryId: string | null
  categoryName: string
  categoryColor: string
  totalAmount: number
  monthStart: string
  monthEnd: string
  currency?: string
  locale?: string
  onEdit?: (expenseId: string) => void
  onAddExpense?: (categoryId: string) => void
  onExpenseDeleted?: () => void
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
  currency = 'USD',
  locale = 'en-US',
  onEdit,
  onAddExpense,
  onExpenseDeleted
}: CategoryDrawerProps) {
  const [expenses, setExpenses] = useState<ExpenseListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)

  useEffect(() => {
    if (open && categoryId) {
      loadExpenses(1)
    } else {
      setExpenses([])
      setPage(1)
    }
  }, [open, categoryId, monthStart, monthEnd])

  const loadExpenses = async (pageNum: number) => {
    if (!categoryId) return

    setLoading(true)

    try {
      const result = await getExpensesByCategoryForMonth(
        categoryId,
        monthStart,
        monthEnd,
        pageNum
      )

      if (pageNum === 1) {
        setExpenses(result.data)
      } else {
        setExpenses(prev => [...prev, ...result.data])
      }

      setHasMore(result.hasMore)
      setPage(pageNum)
    } catch (error: any) {
      toast.error('Failed to load expenses', {
        description: error.message
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string, receiptPath?: string | null) => {
    try {
      // Delete receipt if exists
      if (receiptPath) {
        await deleteReceipt(receiptPath)
      }

      // Delete expense
      const { error } = await deleteExpense(id)
      
      if (error) throw new Error(error)

      toast.success('Expense deleted')
      
      // Reload expenses
      loadExpenses(1)
      onExpenseDeleted?.()
    } catch (error: any) {
      toast.error('Failed to delete expense', {
        description: error.message
      })
    }
  }

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
                {formatCurrency(totalAmount, currency, locale)} • {expenses.length} expenses
              </DrawerDescription>
            </div>
          </div>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading && expenses.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : expenses.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">
                No expenses in this category for this month
              </p>
              {onAddExpense && categoryId && (
                <Button onClick={() => onAddExpense(categoryId)} size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Expense
                </Button>
              )}
            </div>
          ) : (
            <>
              {expenses.map((expense) => (
                <div
                  key={expense.id}
                  className="border rounded-lg p-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium">
                          {expense.merchant || 'No merchant'}
                        </p>
                        <p className="font-semibold">
                          {formatCurrency(expense.amount, expense.currency, locale)}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{format(new Date(expense.date), 'MMM dd, yyyy')}</span>
                        {expense.account && (
                          <>
                            <span>•</span>
                            <span>{expense.account.name}</span>
                          </>
                        )}
                      </div>

                      {expense.notes && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {expense.notes}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
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
                            onClick={() => handleDelete(expense.id, expense.receipt_path)}
                            className="text-destructive"
                          >
                            <Trash className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              ))}

              {hasMore && (
                <Button
                  variant="outline"
                  onClick={() => loadExpenses(page + 1)}
                  disabled={loading}
                  className="w-full"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    'Load More'
                  )}
                </Button>
              )}
            </>
          )}
        </div>

        {onAddExpense && categoryId && expenses.length > 0 && (
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
