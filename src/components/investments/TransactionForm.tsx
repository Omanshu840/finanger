import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { transactionSchema, type TransactionFormInput, transactionTypes } from '@/lib/validations/investment'
import { useAuth } from '@/providers/AuthProvider'
import { listAssets, listPortfolioAccounts, createTransaction, updateTransaction, type InvestmentTransaction } from '@/data/investments'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form'
import { toast } from 'sonner'
import { CalendarIcon, Loader2, Check, ChevronsUpDown } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'

interface TransactionFormProps {
  transaction?: InvestmentTransaction
  preselectedAssetId?: string
  preselectedAccountId?: string
  onSuccess?: () => void
  onCancel?: () => void
}

export default function TransactionForm({
  transaction,
  preselectedAssetId,
  preselectedAccountId,
  onSuccess,
  onCancel
}: TransactionFormProps) {
  const { user } = useAuth()
  const [assets, setAssets] = useState<any[]>([])
  const [accounts, setAccounts] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [assetSearch, setAssetSearch] = useState('')
  const [openAsset, setOpenAsset] = useState(false)

  const form = useForm<TransactionFormInput>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      type: transaction?.type || 'buy',
      asset_id: transaction?.asset_id || preselectedAssetId || '',
      portfolio_account_id: transaction?.portfolio_account_id || preselectedAccountId || '',
      trade_date: transaction?.trade_date ? new Date(transaction.trade_date) : new Date(),
      settle_date: transaction?.settle_date ? new Date(transaction.settle_date) : null,
      quantity: transaction?.quantity || undefined,
      price: transaction?.price || undefined,
      amount: transaction?.amount || undefined,
      fee: transaction?.fee || 0,
      currency: transaction?.currency || 'INR',
      notes: transaction?.notes || ''
    }
  })

  const selectedType = form.watch('type')

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === 'type') {
        // Reset quantity/price/amount based on type
        if (value.type === 'dividend' || value.type === 'interest' || value.type === 'fee') {
          form.setValue('quantity', undefined)
          form.setValue('price', undefined)
        }
      }
    })
    return () => subscription.unsubscribe()
  }, [form])

  const loadData = async () => {
    try {
      const [assetsData, accountsData] = await Promise.all([
        listAssets(),
        listPortfolioAccounts()
      ])

      setAssets(assetsData)
      setAccounts(accountsData)
    } catch (error) {
      console.error('Error loading data:', error)
    }
  }

  const onSubmit = async (values: TransactionFormInput) => {
    if (!user) return

    setLoading(true)

    try {
      const txData = {
        user_id: user.id,
        type: values.type,
        asset_id: values.asset_id || null,
        portfolio_account_id: values.portfolio_account_id,
        trade_date: format(values.trade_date, 'yyyy-MM-dd'),
        settle_date: values.settle_date ? format(values.settle_date, 'yyyy-MM-dd') : null,
        quantity: values.quantity || null,
        price: values.price || null,
        amount: values.amount || null,
        fee: values.fee,
        currency: values.currency,
        notes: values.notes || null
      }

      if (transaction) {
        const { error } = await updateTransaction(transaction.id, txData)
        if (error) throw new Error(error)
        toast.success('Transaction updated')
      } else {
        const { error } = await createTransaction(txData)
        if (error) throw new Error(error)
        toast.success('Transaction added')
      }

      onSuccess?.()
    } catch (error: any) {
      toast.error('Failed to save transaction', {
        description: error.message
      })
    } finally {
      setLoading(false)
    }
  }

  const requiresQuantityAndPrice = ['buy', 'sell', 'split'].includes(selectedType)
  const canHaveAmount = ['dividend', 'interest', 'fee'].includes(selectedType)

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {/* Transaction Type */}
        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Transaction Type</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {transactionTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Asset Selection */}
        {requiresQuantityAndPrice && (
          <FormField
            control={form.control}
            name="asset_id"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Asset</FormLabel>
                <Popover open={openAsset} onOpenChange={setOpenAsset}>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant="outline"
                        role="combobox"
                        className={cn(
                          'justify-between',
                          !field.value && 'text-muted-foreground'
                        )}
                      >
                        {field.value
                          ? assets.find((asset) => asset.id === field.value)?.symbol
                          : 'Select asset'}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0">
                    <Command>
                      <CommandInput
                        placeholder="Search asset..."
                        value={assetSearch}
                        onValueChange={setAssetSearch}
                      />
                      <CommandEmpty>No asset found.</CommandEmpty>
                      <CommandGroup className="max-h-64 overflow-auto">
                        {assets.map((asset) => (
                          <CommandItem
                            key={asset.id}
                            value={asset.symbol}
                            onSelect={() => {
                              form.setValue('asset_id', asset.id)
                              setOpenAsset(false)
                            }}
                          >
                            <Check
                              className={cn(
                                'mr-2 h-4 w-4',
                                asset.id === field.value
                                  ? 'opacity-100'
                                  : 'opacity-0'
                              )}
                            />
                            <div>
                              <p className="font-medium">{asset.symbol}</p>
                              <p className="text-xs text-muted-foreground">{asset.name}</p>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </Command>
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {/* Account Selection */}
        <FormField
          control={form.control}
          name="portfolio_account_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Account</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name} ({account.account_type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Trade Date */}
        <FormField
          control={form.control}
          name="trade_date"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Trade Date</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant="outline"
                      className={cn(
                        'pl-3 text-left font-normal',
                        !field.value && 'text-muted-foreground'
                      )}
                    >
                      {field.value ? format(field.value, 'PPP') : <span>Pick a date</span>}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={field.value}
                    onSelect={field.onChange}
                    disabled={(date) => date > new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Quantity */}
        {requiresQuantityAndPrice && (
          <FormField
            control={form.control}
            name="quantity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Quantity</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.001"
                    placeholder="0"
                    {...field}
                    onChange={(e) => field.onChange(parseFloat(e.target.value) || undefined)}
                    value={field.value || ''}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {/* Price */}
        {requiresQuantityAndPrice && (
          <FormField
            control={form.control}
            name="price"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Price per Unit</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    {...field}
                    onChange={(e) => field.onChange(parseFloat(e.target.value) || undefined)}
                    value={field.value || ''}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {/* Amount */}
        {canHaveAmount && (
          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Amount</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    {...field}
                    onChange={(e) => field.onChange(parseFloat(e.target.value) || undefined)}
                    value={field.value || ''}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {/* Fee */}
        <FormField
          control={form.control}
          name="fee"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Fee/Charges</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  {...field}
                  onChange={(e) => field.onChange(parseFloat(e.target.value))}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Notes */}
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes (Optional)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Add any notes..."
                  rows={2}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Actions */}
        <div className="flex gap-3 pt-4">
          <Button type="submit" disabled={loading} className="flex-1">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : transaction ? (
              'Update Transaction'
            ) : (
              'Add Transaction'
            )}
          </Button>
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>
      </form>
    </Form>
  )
}
