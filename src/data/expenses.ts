import { supabase } from '@/lib/supabase'

export interface ExpenseFilters {
  categoryId?: string
  accountId?: string
  merchant?: string
  minAmount?: number
  maxAmount?: number
  startDate?: string
  endDate?: string
}

export interface ExpenseData {
  account_id: string
  category_id: string
  date: string
  currency: string
  amount: number
  amount_in_base: number
  merchant?: string
  notes?: string
  tags?: string[]
  receipt_path?: string
}

export interface Expense extends ExpenseData {
  id: string
  user_id: string
  created_at: string
  updated_at: string
  account?: { id: string; name: string; type: string }
  category?: { id: string; name: string; color: string }
}

/**
 * List expenses with filters and pagination
 */
export async function listExpenses(
  filters: ExpenseFilters = {},
  page: number = 1,
  pageSize: number = 50
) {
  try {
    let query = supabase
      .from('expenses')
      .select(`
        *,
        account:accounts(id, name, type),
        category:categories(id, name, color)
      `)
      .order('date', { ascending: false })

    // Apply filters
    if (filters.categoryId) {
      query = query.eq('category_id', filters.categoryId)
    }
    if (filters.accountId) {
      query = query.eq('account_id', filters.accountId)
    }
    if (filters.merchant) {
      query = query.ilike('merchant', `%${filters.merchant}%`)
    }
    if (filters.minAmount !== undefined) {
      query = query.gte('amount', filters.minAmount)
    }
    if (filters.maxAmount !== undefined) {
      query = query.lte('amount', filters.maxAmount)
    }
    if (filters.startDate) {
      query = query.gte('date', filters.startDate)
    }
    if (filters.endDate) {
      query = query.lte('date', filters.endDate)
    }

    // Pagination
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1
    query = query.range(from, to)

    const { data, error, count } = await query

    if (error) throw error

    return {
      data: data as Expense[],
      count,
      page,
      pageSize,
      totalPages: count ? Math.ceil(count / pageSize) : 0
    }
  } catch (error: any) {
    console.error('Error listing expenses:', error)
    throw error
  }
}

/**
 * Create a new expense
 */
export async function createExpense(data: ExpenseData) {
  try {
    const { data: expense, error } = await supabase
      .from('expenses')
      .insert([data])
      .select(`
        *,
        account:accounts(id, name, type),
        category:categories(id, name, color)
      `)
      .single()

    if (error) throw error

    return { data: expense as Expense, error: null }
  } catch (error: any) {
    console.error('Error creating expense:', error)
    return { data: null, error: error.message }
  }
}

/**
 * Update an existing expense
 */
export async function updateExpense(id: string, data: Partial<ExpenseData>) {
  try {
    const { data: expense, error } = await supabase
      .from('expenses')
      .update(data)
      .eq('id', id)
      .select(`
        *,
        account:accounts(id, name, type),
        category:categories(id, name, color)
      `)
      .single()

    if (error) throw error

    return { data: expense as Expense, error: null }
  } catch (error: any) {
    console.error('Error updating expense:', error)
    return { data: null, error: error.message }
  }
}

/**
 * Delete an expense
 */
export async function deleteExpense(id: string) {
  try {
    const { error } = await supabase
      .from('expenses')
      .delete()
      .eq('id', id)

    if (error) throw error

    return { error: null }
  } catch (error: any) {
    console.error('Error deleting expense:', error)
    return { error: error.message }
  }
}

export interface CategoryTotal {
  category_id: string
  category_name: string
  category_color: string
  total_amount: number
  expense_count: number
}

export interface ExpenseListItem {
  id: string
  date: string
  merchant: string | null
  amount: number
  currency: string
  receipt_path: string | null
  notes: string | null
  account: {
    id: string
    name: string
    type: string
  } | null
}

/**
 * Get monthly totals grouped by category
 */
export async function getMonthlyCategoryTotals(
  monthStart: string,
  monthEnd: string
): Promise<CategoryTotal[]> {
  try {
    const { data, error } = await supabase
      .from('expenses')
      .select(`
        category_id,
        amount,
        category:categories(id, name, color)
      `)
      .gte('date', monthStart)
      .lte('date', monthEnd)

    if (error) throw error

    // Group by category and sum
    const grouped = new Map<string, CategoryTotal>()

    data?.forEach((expense: any) => {
      if (!expense.category) return

      const categoryId = expense.category_id
      const existing = grouped.get(categoryId)

      if (existing) {
        existing.total_amount += Number(expense.amount)
        existing.expense_count += 1
      } else {
        grouped.set(categoryId, {
          category_id: categoryId,
          category_name: expense.category.name,
          category_color: expense.category.color,
          total_amount: Number(expense.amount),
          expense_count: 1
        })
      }
    })

    return Array.from(grouped.values()).sort((a, b) => 
      b.total_amount - a.total_amount
    )
  } catch (error: any) {
    console.error('Error getting category totals:', error)
    throw error
  }
}

/**
 * Get expenses for a specific category and month
 */
export async function getExpensesByCategoryForMonth(
  categoryId: string,
  monthStart: string,
  monthEnd: string,
  page: number = 1,
  pageSize: number = 50
): Promise<{ data: ExpenseListItem[]; hasMore: boolean }> {
  try {
    const from = (page - 1) * pageSize
    const to = from + pageSize

    const { data, error } = await supabase
      .from('expenses')
      .select(`
        id,
        date,
        merchant,
        amount,
        currency,
        receipt_path,
        notes,
        account:accounts(id, name, type)
      `)
      .eq('category_id', categoryId)
      .gte('date', monthStart)
      .lte('date', monthEnd)
      .order('date', { ascending: false })
      .range(from, to)

    if (error) throw error

    return {
      data: data as ExpenseListItem[],
      hasMore: data.length === pageSize + 1
    }
  } catch (error: any) {
    console.error('Error getting expenses by category:', error)
    throw error
  }
}

