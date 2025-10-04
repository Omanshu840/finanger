import { supabase } from '@/lib/supabase'

export interface Asset {
  id: string
  symbol: string
  name: string
  asset_type: 'stock' | 'mutual_fund' | 'etf' | 'bond' | 'commodity' | 'crypto'
  isin?: string
  exchange?: string
  currency: string
  is_active: boolean
}

export interface PortfolioAccount {
  id: string
  user_id: string
  name: string
  broker_name?: string
  account_number?: string
  linked_account_id?: string
  account_type?: string
  currency: string
  is_archived: boolean
  notes?: string
  created_at: string
  updated_at: string
}


export interface InvestmentTransaction {
  id: string
  user_id: string
  asset_id: string | null
  portfolio_account_id: string
  type: 'buy' | 'sell' | 'dividend' | 'fee' | 'interest' | 'split'
  trade_date: string
  settle_date: string | null
  quantity: number | null
  price: number | null
  amount: number | null
  fee: number
  currency: string
  notes: string | null
  created_at: string
  asset?: Asset
  portfolio_account?: PortfolioAccount
}

/**
 * List investment transactions with filters
 */
export async function listTransactions(filters?: {
  accountId?: string
  assetId?: string
  limit?: number
}): Promise<InvestmentTransaction[]> {
  try {
    let query = supabase
      .from('investment_transactions')
      .select(`
        *,
        asset:assets(*),
        portfolio_account:portfolio_accounts(*)
      `)
      .order('trade_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (filters?.accountId) {
      query = query.eq('portfolio_account_id', filters.accountId)
    }

    if (filters?.assetId) {
      query = query.eq('asset_id', filters.assetId)
    }

    if (filters?.limit) {
      query = query.limit(filters.limit)
    }

    const { data, error } = await query

    if (error) throw error

    return data || []
  } catch (error: any) {
    console.error('Error listing transactions:', error)
    throw error
  }
}

/**
 * Create investment transaction
 */
export async function createTransaction(data: Partial<InvestmentTransaction>) {
  try {
    const { data: transaction, error } = await supabase
      .from('investment_transactions')
      .insert([data])
      .select(`
        *,
        asset:assets(*),
        portfolio_account:portfolio_accounts(*)
      `)
      .single()

    if (error) throw error

    return { data: transaction, error: null }
  } catch (error: any) {
    console.error('Error creating transaction:', error)
    return { data: null, error: error.message }
  }
}

/**
 * Update investment transaction
 */
export async function updateTransaction(
  id: string,
  data: Partial<InvestmentTransaction>
) {
  try {
    const { data: transaction, error } = await supabase
      .from('investment_transactions')
      .update(data)
      .eq('id', id)
      .select(`
        *,
        asset:assets(*),
        portfolio_account:portfolio_accounts(*)
      `)
      .single()

    if (error) throw error

    return { data: transaction, error: null }
  } catch (error: any) {
    console.error('Error updating transaction:', error)
    return { data: null, error: error.message }
  }
}

/**
 * Delete investment transaction
 */
export async function deleteTransaction(id: string) {
  try {
    const { error } = await supabase
      .from('investment_transactions')
      .delete()
      .eq('id', id)

    if (error) throw error

    return { error: null }
  } catch (error: any) {
    console.error('Error deleting transaction:', error)
    return { error: error.message }
  }
}

/**
 * List assets for search/combobox
 */
export async function listAssets(search?: string): Promise<Asset[]> {
  try {
    let query = supabase
      .from('assets')
      .select('*')
      .eq('is_active', true)
      .order('symbol')

    if (search) {
      query = query.or(`symbol.ilike.%${search}%,name.ilike.%${search}%`)
    }

    const { data, error } = await query.limit(20)

    if (error) throw error

    return data || []
  } catch (error: any) {
    console.error('Error listing assets:', error)
    throw error
  }
}

export async function listPortfolioAccounts(): Promise<PortfolioAccount[]> {
  try {
    const { data, error } = await supabase
      .from('portfolio_accounts')
      .select('*')
      .eq('is_archived', false)
      .order('name')

    if (error) throw error

    return data || []
  } catch (error: any) {
    console.error('Error listing portfolio accounts:', error)
    throw error
  }
}
