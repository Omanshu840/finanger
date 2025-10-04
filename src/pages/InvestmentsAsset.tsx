import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/providers/AuthProvider'
import { listTransactions, deleteTransaction } from '@/data/investments'
import { computeHoldings } from '@/lib/holdings'
import { formatCurrency } from '@/lib/currency'
import TransactionForm from '@/components/investments/TransactionForm'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import { ArrowLeft, Plus, Loader2, MoreVertical, Edit, Trash, TrendingUp } from 'lucide-react'
import { format } from 'date-fns'
import { useMediaQuery } from '@/hooks/useMediaQuery'

export default function InvestmentsAsset() {
  const { assetId } = useParams<{ assetId: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<any>()
  const [deleteTransactionId, setDeleteTransactionId] = useState<string | null>(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const isDesktop = useMediaQuery('(min-width: 768px)')

  useEffect(() => {
    if (user && assetId) {
      loadTransactions()
    }
  }, [user, assetId, refreshTrigger])

  const loadTransactions = async () => {
    if (!assetId) return

    setLoading(true)

    try {
      const data = await listTransactions({ assetId })
      setTransactions(data)
    } catch (error: any) {
      toast.error('Failed to load transactions', {
        description: error.message
      })
    } finally {
      setLoading(false)
    }
  }

  // Compute current position
  const holdings = computeHoldings(
    transactions,
    new Map(
      transactions
        .filter(tx => tx.asset)
        .map(tx => [tx.asset.id, { symbol: tx.asset.symbol, name: tx.asset.name }])
    )
  )

  const currentHolding = holdings.find(h => h.asset_id === assetId)
  const asset = transactions[0]?.asset

  const handleEdit = (transaction: any) => {
    setEditingTransaction(transaction)
    setIsFormOpen(true)
  }

  const handleDelete = async (id: string) => {
    try {
      const { error } = await deleteTransaction(id)
      if (error) throw new Error(error)

      toast.success('Transaction deleted')
      setRefreshTrigger(prev => prev + 1)
    } catch (error: any) {
      toast.error('Failed to delete transaction', {
        description: error.message
      })
    } finally {
      setDeleteTransactionId(null)
    }
  }

  const handleFormSuccess = () => {
    setIsFormOpen(false)
    setEditingTransaction(undefined)
    setRefreshTrigger(prev => prev + 1)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!asset) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Asset not found</p>
        <Button onClick={() => navigate('/investments')} className="mt-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Investments
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/investments')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{asset.symbol}</h1>
            <p className="text-sm text-muted-foreground">{asset.name}</p>
          </div>
        </div>

        <Button onClick={() => setIsFormOpen(true)} size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Add
        </Button>
      </div>

      {/* Position Summary */}
      {currentHolding && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">Current Position</h2>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Quantity</p>
                <p className="text-2xl font-bold">{currentHolding.quantity.toFixed(3)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Cost</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(currentHolding.avg_cost, 'INR')}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Cost Basis</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(currentHolding.cost_basis, 'INR')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transactions List */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Transactions</h2>

        {transactions.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed rounded-lg">
            <p className="text-muted-foreground mb-4">No transactions yet</p>
            <Button onClick={() => setIsFormOpen(true)} size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Add First Transaction
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {transactions.map((tx) => (
              <Card key={tx.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                          tx.type === 'buy' ? 'bg-green-500/10 text-green-700 dark:text-green-400' :
                          tx.type === 'sell' ? 'bg-red-500/10 text-red-700 dark:text-red-400' :
                          'bg-blue-500/10 text-blue-700 dark:text-blue-400'
                        }`}>
                          {tx.type.toUpperCase()}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {format(new Date(tx.trade_date), 'MMM dd, yyyy')}
                        </span>
                      </div>

                      <div className="flex items-baseline gap-3 text-sm">
                        {tx.quantity && (
                          <span>
                            <span className="text-muted-foreground">Qty:</span>{' '}
                            <span className="font-medium">{tx.quantity}</span>
                          </span>
                        )}
                        {tx.price && (
                          <span>
                            <span className="text-muted-foreground">@</span>{' '}
                            <span className="font-medium">{formatCurrency(tx.price, tx.currency)}</span>
                          </span>
                        )}
                        {tx.amount && (
                          <span>
                            <span className="text-muted-foreground">Amount:</span>{' '}
                            <span className="font-medium">{formatCurrency(tx.amount, tx.currency)}</span>
                          </span>
                        )}
                      </div>

                      {tx.notes && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {tx.notes}
                        </p>
                      )}
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(tx)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setDeleteTransactionId(tx.id)}
                          className="text-destructive"
                        >
                          <Trash className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Transaction Form - Mobile (Drawer) */}
      {!isDesktop && (
        <Drawer open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DrawerContent className="h-[90vh] overflow-y-auto">
            <DrawerHeader>
              <DrawerTitle>
                {editingTransaction ? 'Edit Transaction' : 'Add Transaction'}
              </DrawerTitle>
            </DrawerHeader>
            <div className="p-4">
              <TransactionForm
                transaction={editingTransaction}
                preselectedAssetId={assetId}
                onSuccess={handleFormSuccess}
                onCancel={() => {
                  setIsFormOpen(false)
                  setEditingTransaction(undefined)
                }}
              />
            </div>
          </DrawerContent>
        </Drawer>
      )}

      {/* Transaction Form - Desktop (Dialog) */}
      {isDesktop && (
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingTransaction ? 'Edit Transaction' : 'Add Transaction'}
              </DialogTitle>
            </DialogHeader>
            <div className="mt-4">
              <TransactionForm
                transaction={editingTransaction}
                preselectedAssetId={assetId}
                onSuccess={handleFormSuccess}
                onCancel={() => {
                  setIsFormOpen(false)
                  setEditingTransaction(undefined)
                }}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTransactionId} onOpenChange={() => setDeleteTransactionId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Transaction?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the transaction and recalculate your holdings.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTransactionId && handleDelete(deleteTransactionId)}
              className="bg-destructive text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
