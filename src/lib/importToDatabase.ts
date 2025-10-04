import { supabase } from '@/lib/supabase'
import { type ParsedEquityHolding, type ParsedMFHolding } from './zerodhaParse'
import { type AMFIRecord } from './amfi'

export interface ImportProgress {
  total: number
  completed: number
  failed: number
  currentItem: string
}

export type ProgressCallback = (progress: ImportProgress) => void

interface SavedAsset {
  id: string
  symbol: string
  name: string
}

/**
 * Get or create portfolio account (using correct schema)
 */
async function ensurePortfolioAccount(
  userId: string,
  accountName: string = 'Zerodha'
): Promise<string> {
  try {
    // Check if account exists
    const { data: existing, error: checkError } = await supabase
      .from('portfolio_accounts')
      .select('id')
      .eq('user_id', userId)
      .eq('name', accountName)
      .eq('is_archived', false)
      .maybeSingle()

    if (checkError) {
      throw checkError
    }

    if (existing) {
      console.log('✅ Using existing account:', existing.id)
      return existing.id
    }

    // Create new account with CORRECT schema
    console.log('📝 Creating new portfolio account:', accountName)
    const { data: account, error: createError } = await supabase
      .from('portfolio_accounts')
      .insert({
        user_id: userId,
        name: accountName,
        broker_name: accountName, // ✅ Changed from 'provider' to 'broker_name'
        account_type: 'brokerage', // ✅ Now exists in schema
        currency: 'INR',
        is_archived: false
      })
      .select('id')
      .single()

    if (createError) {
      console.error('Create account error:', createError)
      throw createError
    }

    console.log('✅ Created account:', account.id)
    return account.id
  } catch (error: any) {
    console.error('Error ensuring portfolio account:', error)
    throw new Error(`Failed to create portfolio account: ${error.message}`)
  }
}

/**
 * Get or create asset
 */
async function ensureAsset(
  symbol: string,
  name: string,
  assetType: 'stock' | 'mutual_fund',
  isin?: string
): Promise<SavedAsset> {
  try {
    // Try to find by ISIN first
    if (isin) {
      const { data: byIsin } = await supabase
        .from('assets')
        .select('id, symbol, name')
        .eq('isin', isin)
        .eq('is_active', true)
        .single()

      if (byIsin) {
        return byIsin
      }
    }

    // Try to find by symbol
    const { data: bySymbol } = await supabase
      .from('assets')
      .select('id, symbol, name')
      .eq('symbol', symbol)
      .eq('type', assetType)
      .eq('is_active', true)
      .single()

    if (bySymbol) {
      return bySymbol
    }

    // Create new asset
    const { data: asset, error } = await supabase
      .from('assets')
      .insert({
        symbol,
        name: name || symbol,
        type: assetType,
        isin: isin || null,
        exchange: assetType === 'stock' ? 'NSE' : null,
        currency: 'INR',
        is_active: true
      })
      .select('id, symbol, name')
      .single()

    if (error) throw error

    return asset
  } catch (error: any) {
    console.error(`Error ensuring asset ${symbol}:`, error)
    throw new Error(`Failed to create asset ${symbol}: ${error.message}`)
  }
}

/**
 * Create buy transaction with correct price and fee
 */
async function createBuyTransaction(
  userId: string,
  assetId: string,
  accountId: string,
  quantity: number,
  price: number,
  fee: number = 0,
  tradeDate: string = (new Date()).toISOString().split('T')[0]
) {
  const { error } = await supabase
    .from('investment_transactions')
    .insert({
      user_id: userId,
      asset_id: assetId,
      portfolio_account_id: accountId,
      type: 'buy',
      trade_date: tradeDate,
      quantity,
      price, // <-- important: use Excel price!
      fee,
      currency: 'INR',
      notes: 'Imported from holdings'
    })

  if (error) throw error
}


/**
 * Save equity holdings to database (WITHOUT prices)
 */
export async function saveEquityHoldings(
  userId: string,
  holdings: Array<{
    holding: ParsedEquityHolding & { avgPrice?: number, fee?: number, tradeDate?: string },
    mappedTicker: string
  }>,
  accountName: string = 'Zerodha',
  onProgress?: ProgressCallback
): Promise<{ success: number; failed: number; errors: string[] }> {
  const errors: string[] = []
  let completed = 0
  let failed = 0

  try {
    const accountId = await ensurePortfolioAccount(userId, accountName)

    for (const { holding, mappedTicker } of holdings) {
      try {
        onProgress?.({
          total: holdings.length,
          completed,
          failed,
          currentItem: holding.sourceSymbol
        })

        // Store mapped ticker in asset metadata for later price fetching
        const asset = await ensureAssetWithTicker(
          holding.sourceSymbol,
          holding.sourceSymbol,
          'stock',
          mappedTicker,
          holding.isin
        )

        const buyPrice = holding.avgPrice || 1 // <-- DEFAULT to 1 if missing
        await createBuyTransaction(
          userId,
          asset.id,
          accountId,
          holding.quantity,
          buyPrice,
          holding.fee || 0,
          holding.tradeDate
        )

        completed++
      } catch (error: any) {
        console.error(`Failed to save ${holding.sourceSymbol}:`, error)
        errors.push(`${holding.sourceSymbol}: ${error.message}`)
        failed++
      }
    }

    return { success: completed, failed, errors }
  } catch (error: any) {
    throw new Error(`Failed to save equity holdings: ${error.message}`)
  }
}


/**
 * Save MF holdings to database (WITHOUT NAV)
 */
export async function saveMFHoldings(
  userId: string,
  holdings: Array<{
    holding: ParsedMFHolding & { avgPrice?: number, nav?: number, fee?: number, tradeDate?: string },
    matched?: AMFIRecord
  }>,
  accountName: string = 'Zerodha',
  onProgress?: ProgressCallback
): Promise<{ success: number; failed: number; errors: string[] }> {
  const errors: string[] = []
  let completed = 0
  let failed = 0

  try {
    const accountId = await ensurePortfolioAccount(userId, accountName)

    for (const { holding, matched } of holdings) {
      try {
        onProgress?.({
          total: holdings.length,
          completed,
          failed,
          currentItem: holding.sourceSymbol
        })

        const schemeName = matched?.schemeName || holding.schemeName || holding.sourceSymbol

        // Create/get asset
        const asset = await ensureAsset(
          holding.sourceSymbol,
          schemeName,
          'mutual_fund',
          holding.isin
        )

        // Create buy transaction WITHOUT NAV
        // Prefer avgPrice, then nav, then fallback to 1
        const mfBuyPrice = holding.avgPrice || holding.nav || 1
        await createBuyTransaction(
          userId,
          asset.id,
          accountId,
          holding.units,
          mfBuyPrice,
          holding.fee || 0,
          holding.tradeDate
        )

        completed++
      } catch (error: any) {
        console.error(`Failed to save ${holding.sourceSymbol}:`, error)
        errors.push(`${holding.sourceSymbol}: ${error.message}`)
        failed++
      }
    }

    return { success: completed, failed, errors }
  } catch (error: any) {
    throw new Error(`Failed to save MF holdings: ${error.message}`)
  }
}

/**
 * Enhanced asset creation with ticker mapping
 */
async function ensureAssetWithTicker(
  symbol: string,
  name: string,
  assetType: 'stock' | 'mutual_fund',
  yahooTicker: string,
  isin?: string
): Promise<SavedAsset> {
  try {
    // Try to find by ISIN first
    if (isin) {
      const { data: byIsin } = await supabase
        .from('assets')
        .select('id, symbol, name')
        .eq('isin', isin)
        .eq('is_active', true)
        .single()

      if (byIsin) {
        // Update with yahoo ticker if not set
        await supabase
          .from('assets')
          .update({ metadata: { yahoo_ticker: yahooTicker } })
          .eq('id', byIsin.id)
        
        return byIsin
      }
    }

    // Try to find by symbol
    const { data: bySymbol } = await supabase
      .from('assets')
      .select('id, symbol, name')
      .eq('symbol', symbol)
      .eq('type', assetType)
      .eq('is_active', true)
      .single()

    if (bySymbol) {
      // Update with yahoo ticker
      await supabase
        .from('assets')
        .update({ metadata: { yahoo_ticker: yahooTicker } })
        .eq('id', bySymbol.id)
      
      return bySymbol
    }

    // Create new asset with ticker
    const { data: asset, error } = await supabase
      .from('assets')
      .insert({
        symbol,
        name: name || symbol,
        type: assetType,
        isin: isin || null,
        exchange: assetType === 'stock' ? 'NSE' : null,
        currency: 'INR',
        is_active: true,
        metadata: { yahoo_ticker: yahooTicker }
      })
      .select('id, symbol, name')
      .single()

    if (error) throw error

    return asset
  } catch (error: any) {
    console.error(`Error ensuring asset ${symbol}:`, error)
    throw new Error(`Failed to create asset ${symbol}: ${error.message}`)
  }
}


/**
 * Save all holdings WITHOUT prices
 */
export async function saveAllHoldings(
  userId: string,
  equityHoldings: Array<{
    holding: ParsedEquityHolding
    mappedTicker: string
  }>,
  mfHoldings: Array<{
    holding: ParsedMFHolding
    matched?: AMFIRecord
  }>,
  accountName: string = 'Zerodha',
  onProgress?: ProgressCallback
): Promise<{
  equity: { success: number; failed: number }
  mf: { success: number; failed: number }
  errors: string[]
}> {
  const allErrors: string[] = []

  const equityResult = await saveEquityHoldings(
    userId,
    equityHoldings,
    accountName,
    onProgress
  )
  allErrors.push(...equityResult.errors)

  const mfResult = await saveMFHoldings(
    userId,
    mfHoldings,
    accountName,
    onProgress
  )
  allErrors.push(...mfResult.errors)

  return {
    equity: { success: equityResult.success, failed: equityResult.failed },
    mf: { success: mfResult.success, failed: mfResult.failed },
    errors: allErrors
  }
}
