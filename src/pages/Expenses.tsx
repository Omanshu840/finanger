import { useEffect, useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/providers/AuthProvider'
import { getMonthlySplitwiseExpenses, type NormalizedSplitwiseExpense } from '@/features/expenses/api/splitwiseExpenses'
import { getAuthStatus } from '@/features/splitwise/api/splitwiseAuth'
import { splitwiseQueryKeys } from '@/features/splitwise/api/queryKeys'
import { mergeMonthlyCategoryTotals, type MergedCategoryTotal } from '@/features/expenses/utils/categoryTotals'
import { formatMonthKey, parseMonthKey, navigateMonth, getMonthRange } from '@/lib/date'
import MonthSwitcher from '@/features/expenses/components/MonthSwitcher'
import CategoryCard from '@/features/expenses/components/CategoryCard'
import CategoryDrawer from '@/features/expenses/components/CategoryDrawer'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Plus, Loader2, WifiOff, Receipt, Link as LinkIcon } from 'lucide-react'
import { isOnline } from '@/lib/utils'
import { mapSplitwiseCategory, getCategoryBucketKey } from '@/features/expenses/utils/splitwiseCategoryMap'
import { SplitwiseExpenseSheet } from '@/features/expenses/components/splitwise/SplitwiseExpenseSheet'

export default function Expenses() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [selectedCategory, setSelectedCategory] = useState<MergedCategoryTotal | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [isFormOpen, setIsFormOpen] = useState(false)
  
  const online = isOnline()

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

  const splitwiseAuthQuery = useQuery({
    queryKey: splitwiseQueryKeys.authStatus(user?.id),
    queryFn: getAuthStatus,
    enabled: Boolean(user),
    staleTime: 10 * 60 * 1000,
  })

  const splitwiseConnected = Boolean(splitwiseAuthQuery.data?.isAuthenticated)

  const splitwiseExpensesQuery = useQuery({
    queryKey: splitwiseQueryKeys.monthlyExpenses(user?.id, startDate, endDate),
    queryFn: () => getMonthlySplitwiseExpenses(startDate, endDate, { skipAuthCheck: true }),
    enabled: Boolean(user && splitwiseConnected),
    staleTime: 10 * 60 * 1000,
  })

  const splitwiseExpenses = splitwiseExpensesQuery.data ?? []

  const mergedTotals = useMemo(
    () => mergeMonthlyCategoryTotals(splitwiseExpenses),
    [splitwiseExpenses]
  )

  const loading = splitwiseAuthQuery.isLoading || (splitwiseConnected && splitwiseExpensesQuery.isLoading)

  const summary = useMemo(() => {
    const totalAmount = mergedTotals.reduce((sum, cat) => sum + cat.total_amount, 0)
    const expenseCount = mergedTotals.reduce((sum, cat) => sum + cat.expense_count, 0)
    const topCategory = mergedTotals.length > 0 ? {
      name: mergedTotals[0].category_name,
      amount: mergedTotals[0].total_amount,
      color: mergedTotals[0].category_color
    } : undefined

    return { totalAmount, expenseCount, topCategory }
  }, [mergedTotals])

  useEffect(() => {
    if (splitwiseExpensesQuery.isError) {
      const error = splitwiseExpensesQuery.error
      console.error('Error loading Splitwise expenses:', error)
      toast.error('Failed to load Splitwise expenses', {
        description: error instanceof Error ? error.message : undefined,
      })
    }
  }, [splitwiseExpensesQuery.error, splitwiseExpensesQuery.isError])

  const handleMonthNavigate = (direction: 'prev' | 'next') => {
    const newMonth = navigateMonth(currentMonth, direction)
    const monthKey = formatMonthKey(newMonth)
    const params = new URLSearchParams(searchParams)
    params.set('m', monthKey)
    setSearchParams(params)
  }

  const handleCategoryClick = (category: MergedCategoryTotal) => {
    setSelectedCategory(category)
    setIsDrawerOpen(true)
  }

  const handleAddExpense = () => {
    setIsDrawerOpen(false)
    setIsFormOpen(true)
  }

  // Filter Splitwise expenses for the selected category (NO API CALL)
  const getSplitwiseItemsForCategory = (category: MergedCategoryTotal): NormalizedSplitwiseExpense[] => {
      if (splitwiseExpenses.length === 0) {
          return []
      }

      // Splitwise expenses already filtered by owed_share > 0 during normalization
      return splitwiseExpenses.filter(swExpense => {
          // Map Splitwise category to bucket key
          const mapping = mapSplitwiseCategory(swExpense.category_name, swExpense.category_id)
          const bucketKey = getCategoryBucketKey(mapping)

          // Check if it matches the selected category
          return bucketKey === category.bucket_key
      })
    }


  return (
    <div className="space-y-6">
    {/* Floating Action Button for mobile */}
      <div className="fixed bottom-18 right-4">
          <Button
              size="icon"
              className="rounded-full h-14 w-14 shadow-lg"
              onClick={() => handleAddExpense()}
          >
              <Plus className="h-6 w-6" />
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

      {/* Splitwise Toggle */}
      {splitwiseConnected ? (
        // <div className="flex items-center justify-between p-4 border rounded-lg bg-card">
        //   <div className="flex items-center gap-3">
        //     <LinkIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
        //     <div>
        //       <Label htmlFor="splitwise-toggle" className="font-medium cursor-pointer">
        //         Include Splitwise Expenses
        //       </Label>
        //       <p className="text-xs text-muted-foreground">
        //         Show shared expenses alongside local expenses
        //       </p>
        //     </div>
        //   </div>
        //   <Switch
        //     id="splitwise-toggle"
        //     checked={includeSplitwise}
        //     onCheckedChange={handleToggleSplitwise}
        //   />
        // </div>
        <></>
      ) : (
        <div className="flex items-center justify-between p-4 border border-dashed rounded-lg">
          <div className="flex items-center gap-3">
            <LinkIcon className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Connect Splitwise</p>
              <p className="text-xs text-muted-foreground">
                Import shared expenses from Splitwise
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.location.href = '/settings/profile'}
          >
            Connect
          </Button>
        </div>
      )}

      {/* Month Switcher */}
      <div className="flex justify-center">
        <MonthSwitcher
          currentMonth={currentMonth}
          onMonthChange={(date) => {
            const monthKey = formatMonthKey(date)
            const params = new URLSearchParams(searchParams)
            params.set('m', monthKey)
            setSearchParams(params)
          }}
          onNavigate={handleMonthNavigate}
          totalAmount={summary.totalAmount}
          expenseCount={summary.expenseCount}
          topCategory={summary.topCategory}
        />
      </div>

      {/* Month Summary */}
      {/* {!loading && mergedTotals.length > 0 && (
        <MonthSummaryCard
          totalAmount={summary.totalAmount}
          expenseCount={summary.expenseCount}
          topCategory={summary.topCategory}
        />
      )} */}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {/* Empty State */}
      {!loading && mergedTotals.length === 0 && (
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
      {!loading && mergedTotals.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Categories</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {mergedTotals.map((category) => (
              <CategoryCard
                key={category.bucket_key}
                categoryName={category.category_name}
                categoryColor={category.category_color}
                totalAmount={category.total_amount}
                expenseCount={category.expense_count}
                hasSplitwise={category.hasSplitwise}
                onClick={() => handleCategoryClick(category)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Category Drawer - Show only Splitwise expenses */}
      {selectedCategory && (
        <CategoryDrawer
          open={isDrawerOpen}
          onOpenChange={setIsDrawerOpen}
          categoryName={selectedCategory.category_name}
          categoryColor={selectedCategory.category_color}
          totalAmount={mergedTotals.find(c => c.bucket_key === selectedCategory.bucket_key)?.total_amount || selectedCategory.total_amount}
          splitwiseItems={getSplitwiseItemsForCategory(selectedCategory)}
        />
      )}

      <SplitwiseExpenseSheet open={isFormOpen} onOpenChange={setIsFormOpen}/>
    </div>
  )
}
