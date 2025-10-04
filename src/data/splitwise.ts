import { splitwiseClient } from '@/lib/splitwiseApi'
import { getAuthStatus } from '@/lib/splitwiseAuth'

export interface SplitwiseExpenseRaw {
  id: number
  cost: string
  description: string
  details: string | null
  date: string
  created_at: string
  created_by: {
    id: number
    first_name: string
    last_name: string
  }
  updated_at: string
  deleted_at: string | null
  category: {
    id: number
    name: string
  }
  group_id: number | null
  friendship_id: number | null
  expense_bundle_id: number | null
  repayments: Array<{
    from: number
    to: number
    amount: string
  }>
  users: Array<{
    user_id: number
    paid_share: string
    owed_share: string
    net_balance: string
  }>
  currency_code: string
}

export interface NormalizedSplitwiseExpense {
  id: number
  date: string
  description: string
  group_name: string
  category_name: string
  currency: string
  user_paid_share: number
  user_owed_share: number
  user_net_share: number
  settled: boolean
  deleted: boolean
  source: 'splitwise'
  created_at: string
}

/**
 * Normalize a Splitwise expense for the current user
 */
export function normalizeSplitwiseExpense(
  expense: SplitwiseExpenseRaw,
  currentUserId: number
): NormalizedSplitwiseExpense | null {
  // Skip deleted expenses
  if (expense.deleted_at) {
    return null
  }

  // Skip settlement/payment transactions
  const description = expense.description.toLowerCase().trim()
  if (
    description === 'settle all balances' ||
    description === 'payment' ||
    description.startsWith('payment:') ||
    description === 'settle up'
  ) {
    return null
  }

  // Find current user's share
  const userShare = expense.users.find(u => u.user_id === currentUserId)
  
  if (!userShare) {
    return null
  }

  const owedShare = parseFloat(userShare.owed_share)
  
  // Only include if user owes something
  if (owedShare <= 0) {
    return null
  }

  // Determine group name
  let groupName = 'Personal'
  if (expense.group_id) {
    groupName = `Group ${expense.group_id}`
  } else if (expense.friendship_id) {
    groupName = `${expense.created_by.first_name} ${expense.created_by.last_name || ''}`
  }

  return {
    id: expense.id,
    date: expense.date,
    description: expense.description,
    group_name: groupName,
    category_name: expense.category.name,
    currency: expense.currency_code,
    user_paid_share: parseFloat(userShare.paid_share),
    user_owed_share: owedShare,
    user_net_share: owedShare,
    settled: Math.abs(parseFloat(userShare.net_balance)) < 0.01,
    deleted: false,
    source: 'splitwise',
    created_at: expense.created_at
  }
}


/**
 * Get monthly Splitwise expenses with pagination
 */
export async function getMonthlySplitwiseExpenses(
  monthStart: string,
  monthEnd: string
): Promise<NormalizedSplitwiseExpense[]> {
  try {
    // Check if connected
    const status = await getAuthStatus()
    if (!status.isAuthenticated) {
      return []
    }

    // Get current user
    const currentUser = await splitwiseClient.getCurrentUser()

    const allExpenses: NormalizedSplitwiseExpense[] = []
    let offset = 0
    const limit = 100
    let hasMore = true

    // Paginate through all expenses for the month
    while (hasMore) {
      const response = await splitwiseClient.getExpenses({
        dated_after: monthStart,
        dated_before: monthEnd,
        limit,
        offset
      })

      if (response.expenses.length === 0) {
        hasMore = false
        break
      }

      // Normalize and filter
      for (const expense of response.expenses) {
        const normalized = normalizeSplitwiseExpense(expense, currentUser.id)
        if (normalized) {
          allExpenses.push(normalized)
        }
      }

      offset += limit

      // Stop if we got fewer than limit (last page)
      if (response.expenses.length < limit) {
        hasMore = false
      }
    }

    return allExpenses
  } catch (error: any) {
    console.error('Error fetching Splitwise expenses:', error)
    
    // If unauthorized, return empty array (connection likely expired)
    if (error.message === 'UNAUTHORIZED') {
      return []
    }
    
    throw error
  }
}

/**
 * Get Splitwise expenses grouped by category
 */
export function groupSplitwiseByCategory(
  expenses: NormalizedSplitwiseExpense[]
): Map<string, { total: number; count: number; items: NormalizedSplitwiseExpense[] }> {
  const grouped = new Map()

  for (const expense of expenses) {
    // Only include positive net share (expenses, not reimbursements)
    if (expense.user_net_share > 0) {
      const categoryKey = expense.category_name.toLowerCase()
      
      const existing = grouped.get(categoryKey) || { total: 0, count: 0, items: [] }
      
      grouped.set(categoryKey, {
        total: existing.total + expense.user_net_share,
        count: existing.count + 1,
        items: [...existing.items, expense]
      })
    }
  }

  return grouped
}
