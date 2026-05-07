// splitwiseApi.ts (Updated)
import { cacheCurrentUser, getCachedCurrentUser, getTokens, storeTokens } from './tokenStorage'

const SPLITWISE_API_BASE = 'https://corsproxy.io/https://secure.splitwise.com/api/v3.0'

export interface SplitwiseUser {
  id: number
  email: string
  first_name: string
  last_name: string
  picture?: {
    medium?: string
  }
}

export interface SplitwiseGroup {
  id: number
  name: string
  group_type?: string
  members: GroupMember[]
  simplify_by_default: boolean
  updated_at?: string
  avatar?: {
    medium?: string
  }
}

export interface GroupMember {
  id: number
  first_name: string
  last_name: string
  email: string
  picture?: {
    medium?: string
  }
  balance?: Array<{
    currency_code: string
    amount: string
  }>
}

export interface SplitwiseFriend {
  id: number
  first_name: string
  last_name: string
  email: string
  updated_at?: string
  picture?: {
    medium?: string
  }
  balance: Array<{
    currency_code: string
    amount: string
  }>
  groups: Array<{
    group_id: number
  }>
}

export interface Currency {
  currency_code: string
  unit: string
}

export interface Category {
  id: number
  name: string
  icon?: string
  icon_types?: {
    square?: {
      large?: string
      xlarge?: string
    }
  }
  subcategories?: Category[]
}

export interface ExpenseUser {
  user_id?: number
  email?: string
  first_name?: string
  last_name?: string
  paid_share: string
  owed_share: string
}

export interface CreateExpensePayload {
  cost: string
  description: string
  details?: string
  date?: string
  group_id?: number
  currency_code?: string
  category_id?: number
  split_equally?: boolean
  users?: ExpenseUser[]
  repeat_interval?: 'never' | 'weekly' | 'fortnightly' | 'monthly' | 'yearly'
}

export interface SplitwiseExpense {
  id: number
  date: string
  description: string
  currency_code: string
  cost: string
  group_id: number | null
  category?: {
    name: string
  }
  users: Array<{
    user_id: number
    owed_share: string
    paid_share: string
  }>
}

export interface NormalizedExpense {
  id: number
  date: string
  description: string
  group: string
  user_share_amount: number
  currency: string
  settled: boolean
  category?: string
}

class SplitwiseClient {
  private async getAccessToken(): Promise<string | null> {
    const tokens = await getTokens()
    return tokens?.access_token || null
  }

  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const token = await this.getAccessToken()

    if (!token) {
      throw new Error('Not authenticated with Splitwise')
    }

    const url = `${SPLITWISE_API_BASE}${endpoint}`

    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options?.headers
      }
    })

    if (response.status === 401) {
      throw new Error('UNAUTHORIZED')
    }

    if (!response.ok) {
      const errorText = await response.text()
      console.error('API Error:', errorText)

      try {
        const errorData = JSON.parse(errorText)
        throw new Error(errorData.error || errorData.message || `HTTP ${response.status}`)
      } catch (e) {
        throw new Error(`HTTP ${response.status}: ${errorText}`)
      }
    }

    return response.json()
  }

  /**
   * Get current user (cached for 24 hours)
   */
  async getCurrentUser(forceRefresh: boolean = false): Promise<SplitwiseUser> {
    if (!forceRefresh) {
      const cached = await getCachedCurrentUser()
      if (cached) {
        console.log('✅ Using cached user:', cached.first_name)
        return cached as SplitwiseUser
      }
    }

    console.log('📥 Fetching current user from API')
    const response = await this.request<{ user: SplitwiseUser }>('/get_current_user')

    await cacheCurrentUser({
      id: response.user.id,
      email: response.user.email,
      first_name: response.user.first_name,
      last_name: response.user.last_name
    })

    const tokens = await getTokens()
    if (tokens) {
      await storeTokens({
        ...tokens,
        user: response.user
      })
    }

    return response.user
  }

  /**
   * Get all groups
   */
  async getGroups(): Promise<SplitwiseGroup[]> {
    const response = await this.request<{ groups: SplitwiseGroup[] }>('/get_groups')
    return response.groups
  }

  /**
   * Get specific group with details
   */
  async getGroup(groupId: number): Promise<SplitwiseGroup> {
    const response = await this.request<{ group: SplitwiseGroup }>(`/get_group/${groupId}`)
    return response.group
  }

  /**
   * Get all friends
   */
  async getFriends(): Promise<SplitwiseFriend[]> {
    const response = await this.request<{ friends: SplitwiseFriend[] }>('/get_friends')
    return response.friends
  }

  /**
   * Get friend details
   */
  async getFriend(friendId: number): Promise<SplitwiseFriend> {
    const response = await this.request<{ friend: SplitwiseFriend }>(`/get_friend/${friendId}`)
    return response.friend
  }

  /**
   * Get available currencies
   */
  async getCurrencies(): Promise<Currency[]> {
    const response = await this.request<{ currencies: Currency[] }>('/get_currencies')
    return response.currencies
  }

  /**
   * Get expense categories
   */
  async getCategories(): Promise<Category[]> {
    const response = await this.request<{ categories: Category[] }>('/get_categories')
    return response.categories
  }

/** Create a new expense
 *
 * Rounding strategy for users[]:
 *  - Round all but the last member's owed_share to 2dp
 *  - Last member gets (total - sum of others) to absorb any floating point residue
 *  - This guarantees sum(owed_shares) === cost exactly, which Splitwise requires
 */
  async createExpense(
    payload: CreateExpensePayload
  ): Promise<{ expense: SplitwiseExpense; errors: any }> {
    const body: any = {
      cost: payload.cost,
      description: payload.description,
      currency_code: payload.currency_code || 'USD',
      date: payload.date || new Date().toISOString(),
    }

    if (payload.details) body.details = payload.details
    if (payload.group_id !== undefined) body.group_id = payload.group_id
    if (payload.category_id) body.category_id = payload.category_id
    if (payload.repeat_interval) body.repeat_interval = payload.repeat_interval

    if (payload.split_equally) {
      body.split_equally = true
    }

    if (payload.users && payload.users.length > 0) {
      const users = this.normalizeUserShares(payload.users, payload.cost)

      users.forEach((user, index) => {
        if (user.user_id) {
          body[`users__${index}__user_id`] = user.user_id
        } else {
          if (user.email) body[`users__${index}__email`] = user.email
          if (user.first_name) body[`users__${index}__first_name`] = user.first_name
          if (user.last_name) body[`users__${index}__last_name`] = user.last_name
        }
        body[`users__${index}__paid_share`] = user.paid_share
        body[`users__${index}__owed_share`] = user.owed_share
      })
    }

    const response = await this.request<{
      expenses: SplitwiseExpense[]
      errors: any
    }>('/create_expense', {
      method: 'POST',
      body: JSON.stringify(body),
    })

    return {
      expense: response.expenses[0],
      errors: response.errors,
    }
  }

  /**
   * Normalize owed_shares so they sum exactly to the expense cost.
   *
   * Problem: callers pass raw floating point strings like "87.333333".
   * If we naively call .toFixed(2) on each, the sum can be off by ±0.01
   * and Splitwise will reject the expense with a validation error.
   *
   * Strategy:
   *  1. Parse all owed_shares as floats
   *  2. Round all but the last to 2dp
   *  3. Give the last member the remainder: total - sum(others)
   *  4. Recalculate paid_shares with the same residue logic so
   *     sum(paid_shares) also equals total exactly
   */
  private normalizeUserShares(
    users: ExpenseUser[],
    costStr: string
  ): ExpenseUser[] {
    if (users.length === 0) return users

    const total = Math.round(parseFloat(costStr) * 100) // work in integer cents

    if (isNaN(total)) return users

    // ── Normalize owed_shares ──────────────────────────────────────────────
    const owedCents = users.map((u) => Math.round(parseFloat(u.owed_share) * 100))
    const normalizedOwed: number[] = []
    let owedAllocated = 0

    owedCents.forEach((cents, i) => {
      if (i === owedCents.length - 1) {
        // Last member absorbs rounding residue
        normalizedOwed.push(total - owedAllocated)
      } else {
        normalizedOwed.push(cents)
        owedAllocated += cents
      }
    })

    // ── Normalize paid_shares ──────────────────────────────────────────────
    const paidCents = users.map((u) => Math.round(parseFloat(u.paid_share) * 100))
    const normalizedPaid: number[] = []
    let paidAllocated = 0

    paidCents.forEach((cents, i) => {
      if (i === paidCents.length - 1) {
        normalizedPaid.push(total - paidAllocated)
      } else {
        normalizedPaid.push(cents)
        paidAllocated += cents
      }
    })

    return users.map((user, i) => ({
      ...user,
      owed_share: (normalizedOwed[i] / 100).toFixed(2),
      paid_share: (normalizedPaid[i] / 100).toFixed(2),
    }))
  }

  /**
   * Get recent expenses
   */
  async getRecentExpenses(limit: number = 20): Promise<NormalizedExpense[]> {
    const response = await this.request<{ expenses: SplitwiseExpense[] }>(
      `/get_expenses?limit=${limit}`
    )

    const currentUser = await this.getCurrentUser()

    return response.expenses.map(expense => {
      const userShare = expense.users.find(u => u.user_id === currentUser.id)
      const owedShare = parseFloat(userShare?.owed_share || '0')
      const paidShare = parseFloat(userShare?.paid_share || '0')
      const netAmount = paidShare - owedShare

      return {
        id: expense.id,
        date: expense.date,
        description: expense.description,
        group: expense.group_id ? `Group ${expense.group_id}` : 'Personal',
        user_share_amount: Math.abs(netAmount),
        currency: expense.currency_code,
        settled: netAmount === 0,
        category: expense.category?.name
      }
    })
  }

  /**
   * Get expenses with filters
   */
  async getExpenses(params: {
    dated_after?: string
    dated_before?: string
    limit?: number
    offset?: number
  }): Promise<{ expenses: any[] }> {
    const queryParams = new URLSearchParams()

    if (params.dated_after) queryParams.append('dated_after', params.dated_after)
    if (params.dated_before) queryParams.append('dated_before', params.dated_before)
    if (params.limit) queryParams.append('limit', params.limit.toString())
    if (params.offset) queryParams.append('offset', params.offset.toString())

    const query = queryParams.toString()
    const endpoint = query ? `/get_expenses?${query}` : '/get_expenses'

    return this.request<{ expenses: any[] }>(endpoint)
  }
}

export const splitwiseClient = new SplitwiseClient()
