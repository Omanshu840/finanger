import { type CategoryTotal } from '@/data/expenses'
import {type  NormalizedSplitwiseExpense } from '@/data/splitwise'
import { mapSplitwiseCategory, getCategoryBucketKey, type CategoryMapping } from './splitwiseMap'

export interface MergedCategoryTotal extends CategoryTotal {
  hasSplitwise: boolean
  splitwise_count?: number
  bucket_key: string
  mapping?: CategoryMapping
}

/**
 * Merge local and Splitwise category totals
 */
export function mergeMonthlyCategoryTotals(
  localTotals: CategoryTotal[],
  splitwiseExpenses: NormalizedSplitwiseExpense[],
  localCategories: Array<{ id: string; name: string; color: string }>
): MergedCategoryTotal[] {
  const merged = new Map<string, MergedCategoryTotal>()

  // Add local totals
  for (const local of localTotals) {
    const bucketKey = local.category_id
    merged.set(bucketKey, {
      ...local,
      hasSplitwise: false,
      bucket_key: bucketKey
    })
  }

  // Group Splitwise expenses by mapped category
  // Already filtered by owed_share > 0 in normalization
  for (const swExpense of splitwiseExpenses) {
    const mapping = mapSplitwiseCategory(swExpense.category_name, localCategories)
    const bucketKey = getCategoryBucketKey(mapping)

    const existing = merged.get(bucketKey)

    if (existing) {
      // Add to existing category
      existing.total_amount += swExpense.user_owed_share
      existing.expense_count += 1
      existing.hasSplitwise = true
      existing.splitwise_count = (existing.splitwise_count || 0) + 1
    } else {
      // Create new virtual category
      merged.set(bucketKey, {
        category_id: mapping.category_id || bucketKey,
        category_name: mapping.ui_name,
        category_color: mapping.color,
        total_amount: swExpense.user_owed_share,
        expense_count: 1,
        hasSplitwise: true,
        splitwise_count: 1,
        bucket_key: bucketKey,
        mapping
      })
    }
  }

  // Sort by total amount descending
  return Array.from(merged.values()).sort((a, b) => b.total_amount - a.total_amount)
}

/**
 * Merge local and Splitwise expenses for drawer display
 */
export function mergeDrawerItems(
  localItems: any[],
  splitwiseItems: NormalizedSplitwiseExpense[]
): Array<any & { source: 'local' | 'splitwise' }> {
  const merged = [
    ...localItems.map(item => ({ ...item, source: 'local' as const })),
    // Splitwise items already filtered by owed_share > 0
    ...splitwiseItems.map(item => ({ ...item, source: 'splitwise' as const }))
  ]

  // Sort by date descending
  return merged.sort((a, b) => {
    const dateA = new Date(a.date || a.created_at).getTime()
    const dateB = new Date(b.date || b.created_at).getTime()
    return dateB - dateA
  })
}



