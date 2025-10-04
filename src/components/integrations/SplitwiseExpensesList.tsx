import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { splitwiseClient, type NormalizedExpense } from '@/lib/splitwiseApi'
import { getAuthStatus } from '@/lib/splitwiseAuth'
import { formatCurrency } from '@/lib/currency'
import { toast } from 'sonner'
import { Loader2, RefreshCw, CheckCircle2, Circle } from 'lucide-react'
import { format } from 'date-fns'

export default function SplitwiseExpensesList() {
  const [expenses, setExpenses] = useState<NormalizedExpense[]>([])
  const [loading, setLoading] = useState(true)
  const [isConnected, setIsConnected] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    loadExpenses()
  }, [])

  const loadExpenses = async () => {
    try {
      const status = await getAuthStatus()
      setIsConnected(status.isAuthenticated)

      if (!status.isAuthenticated) {
        setLoading(false)
        return
      }

      const data = await splitwiseClient.getRecentExpenses(20)
      setExpenses(data)
    } catch (error: any) {
      if (error.message === 'UNAUTHORIZED') {
        toast.error('Splitwise session expired', {
          description: 'Please reconnect your account'
        })
        setIsConnected(false)
      } else {
        toast.error('Failed to load expenses', {
          description: error.message
        })
      }
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadExpenses()
    setRefreshing(false)
    toast.success('Expenses refreshed')
  }

  if (!isConnected) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Recent Splitwise Expenses</CardTitle>
            <CardDescription>
              Your share of recent shared expenses
            </CardDescription>
          </div>
          <Button
            onClick={handleRefresh}
            disabled={refreshing}
            variant="outline"
            size="sm"
          >
            {refreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : expenses.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>No recent expenses found</p>
          </div>
        ) : (
          <div className="space-y-2">
            {expenses.map((expense) => (
              <div
                key={expense.id}
                className="flex items-start justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {expense.settled ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                    ) : (
                      <Circle className="h-4 w-4 text-orange-600 dark:text-orange-400 flex-shrink-0" />
                    )}
                    <p className="font-medium truncate">{expense.description}</p>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{format(new Date(expense.date), 'MMM dd, yyyy')}</span>
                    <span>•</span>
                    <span>{expense.group}</span>
                    {expense.category && (
                      <>
                        <span>•</span>
                        <span>{expense.category}</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="text-right ml-4 flex-shrink-0">
                  <p className="font-semibold">
                    {formatCurrency(expense.user_share_amount, expense.currency)}
                  </p>
                  {expense.settled && (
                    <p className="text-xs text-green-600 dark:text-green-400">
                      Settled
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
