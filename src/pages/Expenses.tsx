import { useEffect, useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '@/providers/AuthProvider'
import { getMonthlyCategoryTotals } from '@/data/expenses'
import { getMonthlySplitwiseExpenses, type NormalizedSplitwiseExpense } from '@/data/splitwise'
import { getAuthStatus } from '@/lib/splitwiseAuth'
import { mergeMonthlyCategoryTotals, type MergedCategoryTotal } from '@/lib/merge'
import { formatMonthKey, parseMonthKey, navigateMonth, getMonthRange } from '@/lib/date'
import { supabase } from '@/lib/supabase'
import MonthSwitcher from '@/components/expenses/MonthSwitcher'
import CategoryCard from '@/components/expenses/CategoryCard'
import CategoryDrawer from '@/components/expenses/CategoryDrawer'
import ExpenseForm from '@/components/expenses/ExpenseForm'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Plus, Loader2, WifiOff, Receipt, Link as LinkIcon } from 'lucide-react'
import { isOnline } from '@/lib/utils'
import { mapSplitwiseCategory, getCategoryBucketKey } from '@/lib/splitwiseMap'

export default function Expenses() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [mergedTotals, setMergedTotals] = useState<MergedCategoryTotal[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<MergedCategoryTotal | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [preselectedCategory, setPreselectedCategory] = useState<string | undefined>()
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [splitwiseConnected, setSplitwiseConnected] = useState(false)
  
  // Store ALL Splitwise expenses for the month (fetched once per month)
  const [splitwiseExpenses, setSplitwiseExpenses] = useState<NormalizedSplitwiseExpense[]>([])
  const [localCategories, setLocalCategories] = useState<Array<{ id: string; name: string; color: string }>>([])
  
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
    const initializeData = async () => {
      if (!user) return

      console.log('🔄 Initializing expenses page...')

      // Check Splitwise connection first
      const status = await getAuthStatus()
      setSplitwiseConnected(status.isAuthenticated)
      console.log('   Splitwise connected:', status.isAuthenticated)

      // Then load data
      await loadAllData(status.isAuthenticated)
    }

    initializeData()
  }, [user, startDate, endDate])

  const loadAllData = async (isSplitwiseConnected?: boolean) => {
    setLoading(true)

    // Use passed value or state value
    const swConnected = isSplitwiseConnected ?? splitwiseConnected

    try {
      // Load local categories (needed for mapping)
      const { data: categories } = await supabase
        .from('categories')
        .select('id, name, color')
        .eq('user_id', user!.id)
        .eq('type', 'expense')
        .eq('is_archived', false)

      setLocalCategories(categories || [])

      // Load local totals
      const localTotals = await getMonthlyCategoryTotals(startDate, endDate)

      // Load Splitwise ONCE if enabled and connected
      let swExpenses: NormalizedSplitwiseExpense[] = []
      if (swConnected) {
        try {
          console.log('📥 Fetching Splitwise expenses for:', startDate, 'to', endDate)
          swExpenses = await getMonthlySplitwiseExpenses(startDate, endDate)
          console.log('✅ Fetched', swExpenses.length, 'Splitwise expenses')
        } catch (error) {
          console.error('❌ Error loading Splitwise:', error)
          toast.error('Failed to load Splitwise expenses')
        }
      } else {
        console.log('⏭️ Skipping Splitwise fetch connected:', swConnected, ')')
      }

      // Store Splitwise expenses in state
      setSplitwiseExpenses(swExpenses)

      // Merge totals
      const merged = mergeMonthlyCategoryTotals(
        localTotals,
        swExpenses,
        categories || []
      )

      setMergedTotals(merged)
      console.log('✅ Loaded', merged.length, 'categories')
    } catch (error: any) {
      console.error('❌ Error loading expenses:', error)
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
    const params = new URLSearchParams(searchParams)
    params.set('m', monthKey)
    setSearchParams(params)
  }

  const handleCategoryClick = (category: MergedCategoryTotal) => {
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
    
    // Reload data
    loadAllData()
    
    setRefreshTrigger(prev => prev + 1)
    
    if (preselectedCategory && selectedCategory) {
      setTimeout(() => {
        setIsDrawerOpen(true)
      }, 100)
    }
  }

  const handleExpenseDeleted = () => {
    // Reload data
    loadAllData()
    
    setRefreshTrigger(prev => prev + 1)
  }

  // Filter Splitwise expenses for the selected category (NO API CALL)
    const getSplitwiseItemsForCategory = (category: MergedCategoryTotal): NormalizedSplitwiseExpense[] => {
        if (splitwiseExpenses.length === 0) {
            return []
        }

        // Splitwise expenses already filtered by owed_share > 0 during normalization
        return splitwiseExpenses.filter(swExpense => {
            // Map Splitwise category to bucket key
            const mapping = mapSplitwiseCategory(swExpense.category_name, localCategories)
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
                categoryId={category.category_id}
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

      {/* Category Drawer - Pass filtered Splitwise items (NO API CALL) */}
      {selectedCategory && (
        <CategoryDrawer
          key={refreshTrigger}
          open={isDrawerOpen}
          onOpenChange={setIsDrawerOpen}
          categoryId={selectedCategory.category_id}
          categoryName={selectedCategory.category_name}
          categoryColor={selectedCategory.category_color}
          totalAmount={mergedTotals.find(c => c.bucket_key === selectedCategory.bucket_key)?.total_amount || selectedCategory.total_amount}
          monthStart={startDate}
          monthEnd={endDate}
          splitwiseItems={getSplitwiseItemsForCategory(selectedCategory)}
          onAddExpense={handleAddExpense}
          onExpenseDeleted={handleExpenseDeleted}
          refreshKey={refreshTrigger}
        />
      )}

      {/* Add Expense Form */}
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