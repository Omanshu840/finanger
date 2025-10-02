import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { expenseSchema, type ExpenseFormInput } from '@/lib/validations/expense'
import { useAuth } from '@/providers/AuthProvider'
import { supabase } from '@/lib/supabase'
import { uploadReceipt, deleteReceipt } from '@/lib/storage'
import { createExpense, updateExpense, type Expense } from '@/data/expenses'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { toast } from 'sonner'
import { CalendarIcon, Upload, X, Loader2, FileText } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'

interface Account {
  id: string
  name: string
  type: string
  currency: string
}

interface Category {
  id: string
  name: string
  type: string
  color: string
}

interface ExpenseFormProps {
  expense?: Expense
  onSuccess?: () => void
  onCancel?: () => void
  preselectedCategoryId?: string  // Add this
}

export default function ExpenseForm({ expense, onSuccess, onCancel, preselectedCategoryId }: ExpenseFormProps) {
  const { user } = useAuth()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const form = useForm<ExpenseFormInput>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      account_id: expense?.account_id || '',
      category_id: expense?.category_id || preselectedCategoryId || '',  // Update this
      date: expense?.date ? new Date(expense.date) : new Date(),
      currency: expense?.currency || 'USD',
      amount: expense?.amount || 0,
      merchant: expense?.merchant || '',
      notes: expense?.notes || '',
      tags: expense?.tags ? expense.tags : [],
      receipt: null
    }
  })

  // Load accounts and categories
  useEffect(() => {
    loadAccountsAndCategories()
  }, [user])

  // Set default currency from user profile
  useEffect(() => {
    const loadProfile = async () => {
      if (!user) return
      
      const { data } = await supabase
        .from('profiles')
        .select('base_currency')
        .eq('user_id', user.id)
        .single()

      if (data && !expense) {
        form.setValue('currency', data.base_currency)
      }
    }

    loadProfile()
  }, [user, expense])

  const loadAccountsAndCategories = async () => {
    if (!user) return

    try {
      // Load accounts
      const { data: accountsData } = await supabase
        .from('accounts')
        .select('id, name, type, currency')
        .eq('user_id', user.id)
        .eq('is_archived', false)
        .order('name')

      if (accountsData) {
        setAccounts(accountsData)
      }

      // Load expense categories
      const { data: categoriesData } = await supabase
        .from('categories')
        .select('id, name, type, color')
        .eq('user_id', user.id)
        .eq('type', 'expense')
        .eq('is_archived', false)
        .order('name')

      if (categoriesData) {
        setCategories(categoriesData)
      }
    } catch (error) {
      console.error('Error loading data:', error)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      form.setValue('receipt', file)

      // Create preview for images
      if (file.type.startsWith('image/')) {
        const reader = new FileReader()
        reader.onloadend = () => {
          setPreviewUrl(reader.result as string)
        }
        reader.readAsDataURL(file)
      }
    }
  }

  const clearReceipt = () => {
    setSelectedFile(null)
    setPreviewUrl(null)
    form.setValue('receipt', null)
  }

  const onSubmit = async (values: ExpenseFormInput) => {
    if (!user) return

    setLoading(true)

    try {
      let receiptPath = expense?.receipt_path

      // Upload new receipt if selected
      if (selectedFile) {
        setUploading(true)
        const { path, error: uploadError } = await uploadReceipt(selectedFile, user.id)
        
        if (uploadError) {
          toast.error('Failed to upload receipt', {
            description: uploadError
          })
          setLoading(false)
          setUploading(false)
          return
        }

        // Delete old receipt if replacing
        if (expense?.receipt_path) {
          await deleteReceipt(expense.receipt_path)
        }

        receiptPath = path
        setUploading(false)
      }

      // Prepare expense data
      const expenseData = {
        account_id: values.account_id,
        category_id: values.category_id,
        date: format(values.date, 'yyyy-MM-dd'),
        currency: values.currency,
        amount: values.amount,
        amount_in_base: values.amount, // TODO: Convert to base currency
        merchant: values.merchant || undefined,
        notes: values.notes || undefined,
        tags: values.tags,
        receipt_path: receiptPath ?? undefined
      }

      if (expense) {
        // Update existing expense
        const { error } = await updateExpense(expense.id, expenseData)
        
        if (error) throw new Error(error)

        toast.success('Expense updated')
      } else {
        // Create new expense
        const { error } = await createExpense({
          ...expenseData,
          user_id: user.id
        } as any)

        if (error) throw new Error(error)

        toast.success('Expense added')
      }

      onSuccess?.()
    } catch (error: any) {
      toast.error('Failed to save expense', {
        description: error.message
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Date */}
        <FormField
          control={form.control}
          name="date"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Date</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full pl-3 text-left font-normal',
                        !field.value && 'text-muted-foreground'
                      )}
                    >
                      {field.value ? (
                        format(field.value, 'PPP')
                      ) : (
                        <span>Pick a date</span>
                      )}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={field.value}
                    onSelect={field.onChange}
                    disabled={(date) =>
                      date > new Date() || date < new Date('1900-01-01')
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Account */}
        <FormField
          control={form.control}
          name="account_id"
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
                      {account.name} ({account.type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Category */}
        <FormField
          control={form.control}
          name="category_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Category</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: category.color }}
                        />
                        {category.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Amount and Currency */}
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2">
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      inputMode="decimal"
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
          </div>

          <FormField
            control={form.control}
            name="currency"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Currency</FormLabel>
                <FormControl>
                  <Input
                    placeholder="USD"
                    maxLength={3}
                    {...field}
                    onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Merchant */}
        <FormField
          control={form.control}
          name="merchant"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Merchant (Optional)</FormLabel>
              <FormControl>
                <Input placeholder="Starbucks, Amazon, etc." {...field} />
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
                  placeholder="Add any additional details..."
                  rows={3}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Receipt Upload */}
        <div className="space-y-2">
          <Label>Receipt (Optional)</Label>
          
          {!selectedFile && !expense?.receipt_path && (
            <div className="border-2 border-dashed rounded-lg p-6 text-center">
              <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground mb-2">
                Upload a receipt (JPG, PNG, or PDF, max 5MB)
              </p>
              <Input
                type="file"
                accept="image/jpeg,image/jpg,image/png,application/pdf"
                onChange={handleFileChange}
                className="hidden"
                id="receipt-upload"
              />
              <Label htmlFor="receipt-upload">
                <Button type="button" variant="outline" size="sm" asChild>
                  <span>Choose File</span>
                </Button>
              </Label>
            </div>
          )}

          {selectedFile && (
            <div className="border rounded-lg p-4 flex items-center gap-3">
              {previewUrl ? (
                <img src={previewUrl} alt="Preview" className="w-16 h-16 object-cover rounded" />
              ) : (
                <FileText className="w-16 h-16 text-muted-foreground" />
              )}
              <div className="flex-1">
                <p className="text-sm font-medium">{selectedFile.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(selectedFile.size / 1024).toFixed(2)} KB
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={clearReceipt}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          {expense?.receipt_path && !selectedFile && (
            <div className="border rounded-lg p-4 flex items-center gap-3">
              <FileText className="w-16 h-16 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm font-medium">Existing receipt</p>
                <p className="text-xs text-muted-foreground">
                  Replace by uploading a new file
                </p>
              </div>
              <Input
                type="file"
                accept="image/jpeg,image/jpg,image/png,application/pdf"
                onChange={handleFileChange}
                className="hidden"
                id="receipt-replace"
              />
              <Label htmlFor="receipt-replace">
                <Button type="button" variant="outline" size="sm" asChild>
                  <span>Replace</span>
                </Button>
              </Label>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4">
          <Button
            type="submit"
            disabled={loading || uploading}
            className="flex-1"
          >
            {uploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : expense ? (
              'Update Expense'
            ) : (
              'Add Expense'
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
