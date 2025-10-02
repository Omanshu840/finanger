import { useEffect, useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '@/providers/AuthProvider'
import { getMonthlyCategoryTotals, type CategoryTotal } from '@/data/expenses'
import { formatMonthKey, parseMonthKey, navigateMonth, getMonthRange } from '@/lib/date'
import MonthSwitcher from '@/components/expenses/MonthSwitcher'
import MonthSummaryCard from '@/components/expenses/MonthSummaryCard'
import CategoryCard from '@/components/expenses/CategoryCard'
import CategoryDrawer from '@/components/expenses/CategoryDrawer'
import ExpenseForm from '@/components/expenses/ExpenseForm'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Plus, Loader2, WifiOff, Receipt } from 'lucide-react'
import { isOnline } from '@/lib/utils'

export default function Expenses() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [categoryTotals, setCategoryTotals] = useState<CategoryTotal[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<CategoryTotal | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [preselectedCategory, setPreselectedCategory] = useState<string | undefined>()
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const online = isOnline()

  // Get current month from URL or default to today
  const currentMonth = useMemo(() => {
    const monthParam = searchParams.get('m')
    if (monthParam) {
      const parsed = parseMonthKey(monthParam)
      if (parsed) return parsed
    }
    return new Date()
  }, [searchParams])

  const { startDate, endDate } = useMemo(() => 
    getMonthRange(currentMonth),
    [currentMonth]
  )

  // Calculate summary stats
  const summary = useMemo(() => {
    const totalAmount = categoryTotals.reduce((sum, cat) => sum + cat.total_amount, 0)
    const expenseCount = categoryTotals.reduce((sum, cat) => sum + cat.expense_count, 0)
    const topCategory = categoryTotals.length > 0 ? {
      name: categoryTotals[0].category_name,
      amount: categoryTotals[0].total_amount,
      color: categoryTotals[0].category_color
    } : undefined

    return { totalAmount, expenseCount, topCategory }
  }, [categoryTotals])

  // In-memory cache for month data
  const [cache] = useState(() => new Map<string, CategoryTotal[]>())

  // Load category totals for current month
  useEffect(() => {
    if (user) {
      loadCategoryTotals()
    }
  }, [user, startDate, endDate])

  const loadCategoryTotals = async () => {
    const cacheKey = formatMonthKey(currentMonth)

    // Check cache first
    if (cache.has(cacheKey)) {
      setCategoryTotals(cache.get(cacheKey)!)
      setLoading(false)
      return
    }

    setLoading(true)

    try {
      const totals = await getMonthlyCategoryTotals(startDate, endDate)
      setCategoryTotals(totals)
      cache.set(cacheKey, totals)
    } catch (error: any) {
      toast.error('Failed to load expenses', {
        description: error.message
      })
    } finally {
      setLoading(false)
    }
  }

  const handleMonthNavigate = (direction: 'prev' | 'next') => {
    const newMonth = navigateMonth(currentMonth, direction)
    const monthKey = formatMonthKey(newMonth)
    setSearchParams({ m: monthKey })
  }

  const handleCategoryClick = (category: CategoryTotal) => {
    setSelectedCategory(category)
    setIsDrawerOpen(true)
  }

  const handleAddExpense = (categoryId?: string) => {
    setPreselectedCategory(categoryId)
    setIsDrawerOpen(false)
    setIsFormOpen(true)
  }

  const handleFormSuccess = () => {
    setIsFormOpen(false)
    setPreselectedCategory(undefined)
    
    // Invalidate cache and reload
    const cacheKey = formatMonthKey(currentMonth)
    cache.delete(cacheKey)
    loadCategoryTotals()
    
    // Trigger drawer refresh
    setRefreshTrigger(prev => prev + 1)
    
    // Reopen the drawer if a category was selected
    if (preselectedCategory && selectedCategory) {
      setTimeout(() => {
        setIsDrawerOpen(true)
      }, 100)
    }
  }

  const handleExpenseDeleted = () => {
    // Invalidate cache and reload
    const cacheKey = formatMonthKey(currentMonth)
    cache.delete(cacheKey)
    loadCategoryTotals()
    
    // Trigger drawer refresh
    setRefreshTrigger(prev => prev + 1)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Expenses</h1>
          <p className="text-muted-foreground">
            Monthly spending by category
          </p>
        </div>

        <Button
          onClick={() => handleAddExpense()}
          disabled={!online}
          size="default"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Expense
        </Button>
      </div>

      {/* Offline Warning */}
      {!online && (
        <div className="flex items-center gap-2 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
          <WifiOff className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            You're offline. Viewing cached data.
          </p>
        </div>
      )}

      {/* Month Switcher */}
      <div className="flex justify-center">
        <MonthSwitcher
          currentMonth={currentMonth}
          onMonthChange={(date) => {
            const monthKey = formatMonthKey(date)
            setSearchParams({ m: monthKey })
          }}
          onNavigate={handleMonthNavigate}
        />
      </div>

      {/* Month Summary Card */}
      {!loading && categoryTotals.length > 0 && (
        <MonthSummaryCard
          totalAmount={summary.totalAmount}
          expenseCount={summary.expenseCount}
          topCategory={summary.topCategory}
        />
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {/* Empty State */}
      {!loading && categoryTotals.length === 0 && (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <Receipt className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No expenses this month</h3>
          <p className="text-muted-foreground mb-4">
            Start tracking your spending by adding an expense
          </p>
          <Button onClick={() => handleAddExpense()} disabled={!online}>
            <Plus className="mr-2 h-4 w-4" />
            Add First Expense
          </Button>
        </div>
      )}

      {/* Category Grid */}
      {!loading && categoryTotals.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Categories</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {categoryTotals.map((category) => (
              <CategoryCard
                key={category.category_id}
                categoryId={category.category_id}
                categoryName={category.category_name}
                categoryColor={category.category_color}
                totalAmount={category.total_amount}
                expenseCount={category.expense_count}
                onClick={() => handleCategoryClick(category)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Category Drawer */}
      {selectedCategory && (
        <CategoryDrawer
          key={refreshTrigger}
          open={isDrawerOpen}
          onOpenChange={setIsDrawerOpen}
          categoryId={selectedCategory.category_id}
          categoryName={selectedCategory.category_name}
          categoryColor={selectedCategory.category_color}
          totalAmount={categoryTotals.find(c => c.category_id === selectedCategory.category_id)?.total_amount || selectedCategory.total_amount}
          monthStart={startDate}
          monthEnd={endDate}
          onAddExpense={handleAddExpense}
          onExpenseDeleted={handleExpenseDeleted}
        />
      )}

      {/* Add Expense Form - Modal for all screen sizes */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Expense</DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            <ExpenseForm
              onSuccess={handleFormSuccess}
              onCancel={() => {
                setIsFormOpen(false)
                setPreselectedCategory(undefined)
              }}
              preselectedCategoryId={preselectedCategory}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
