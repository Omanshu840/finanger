import { supabase } from '@/lib/supabase'

interface CategorySeed {
  name: string
  type: 'expense' | 'income'
  color: string
  sort_order: number
}

const defaultCategories: CategorySeed[] = [
  // Essential expenses
  { name: 'Groceries', type: 'expense', color: '#10b981', sort_order: 1 },
  { name: 'Rent/Mortgage', type: 'expense', color: '#ef4444', sort_order: 2 },
  { name: 'Utilities', type: 'expense', color: '#f59e0b', sort_order: 3 },
  { name: 'Transportation', type: 'expense', color: '#3b82f6', sort_order: 4 },
  { name: 'Gas/Fuel', type: 'expense', color: '#8b5cf6', sort_order: 5 },
  
  // Health & wellness
  { name: 'Healthcare', type: 'expense', color: '#ec4899', sort_order: 6 },
  { name: 'Fitness', type: 'expense', color: '#14b8a6', sort_order: 7 },
  { name: 'Personal Care', type: 'expense', color: '#f97316', sort_order: 8 },
  
  // Food & dining
  { name: 'Dining Out', type: 'expense', color: '#06b6d4', sort_order: 9 },
  { name: 'Food', type: 'expense', color: '#84cc16', sort_order: 10 },
  
  // Entertainment & lifestyle
  { name: 'Entertainment', type: 'expense', color: '#a855f7', sort_order: 11 },
  { name: 'Shopping', type: 'expense', color: '#e11d48', sort_order: 12 },
  { name: 'Subscriptions', type: 'expense', color: '#0ea5e9', sort_order: 13 },
  { name: 'Travel', type: 'expense', color: '#22c55e', sort_order: 14 },
  { name: 'Hobbies', type: 'expense', color: '#facc15', sort_order: 15 },
  
  // Bills & services
  { name: 'Phone/Internet', type: 'expense', color: '#6366f1', sort_order: 16 },
  { name: 'Insurance', type: 'expense', color: '#dc2626', sort_order: 17 },
  { name: 'Taxes', type: 'expense', color: '#78716c', sort_order: 18 },
  
  // Education & family
  { name: 'Education', type: 'expense', color: '#0891b2', sort_order: 19 },
  { name: 'Gifts', type: 'expense', color: '#f472b6', sort_order: 21 },
  { name: 'Charity', type: 'expense', color: '#4ade80', sort_order: 22 },
  
  // Other
  { name: 'Miscellaneous', type: 'expense', color: '#94a3b8', sort_order: 23 },
  
  // Income categories
  { name: 'Salary', type: 'income', color: '#059669', sort_order: 24 },
  { name: 'Freelance', type: 'income', color: '#16a34a', sort_order: 25 },
  { name: 'Investment Income', type: 'income', color: '#65a30d', sort_order: 26 },
  { name: 'Other Income', type: 'income', color: '#84cc16', sort_order: 27 }
]

const defaultAccounts = [
  { name: 'Cash', type: 'cash', currency: 'USD' },
  { name: 'Bank Account', type: 'bank', currency: 'USD' },
  { name: 'Credit Card', type: 'credit_card', currency: 'USD' }
]

/**
 * Check if user needs initial data and seed if necessary
 */
export async function checkAndSeedUserData(userId: string): Promise<boolean> {
  try {
    // Check if user already has categories
    const { data: existingCategories, error: catError } = await supabase
      .from('categories')
      .select('id')
      .eq('user_id', userId)
      .limit(1)

    if (catError) throw catError

    // User already has data, skip seeding
    if (existingCategories && existingCategories.length > 0) {
      return false
    }

    // Seed categories
    const categoriesToInsert = defaultCategories.map(cat => ({
      user_id: userId,
      ...cat,
      is_archived: false
    }))

    const { error: categoryInsertError } = await supabase
      .from('categories')
      .insert(categoriesToInsert)

    if (categoryInsertError) throw categoryInsertError

    // Seed default accounts
    const accountsToInsert = defaultAccounts.map(acc => ({
      user_id: userId,
      ...acc,
      initial_balance: 0,
      current_balance: 0,
      is_archived: false
    }))

    const { error: accountInsertError } = await supabase
      .from('accounts')
      .insert(accountsToInsert)

    if (accountInsertError) throw accountInsertError

    // Create default profile if it doesn't exist
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        user_id: userId,
        base_currency: 'USD',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        locale: navigator.language || 'en-US'
      })
      .select()
      .single()

    // Ignore conflict errors (profile might already exist)
    if (profileError && profileError.code !== '23505') {
      console.error('Profile creation error:', profileError)
    }

    console.log('✅ Successfully seeded default data for new user')
    return true
  } catch (error: any) {
    console.error('Error seeding user data:', error)
    return false
  }
}
