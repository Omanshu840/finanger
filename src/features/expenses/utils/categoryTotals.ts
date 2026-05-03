import { type NormalizedSplitwiseExpense } from '@/features/expenses/api/splitwiseExpenses'
import { mapSplitwiseCategory, getCategoryBucketKey, type CategoryMapping } from './splitwiseCategoryMap'

export interface MergedCategoryTotal {
  category_id: string
  category_name: string
  category_color: string
  total_amount: number
  expense_count: number
  hasSplitwise: boolean
  splitwise_count?: number
  bucket_key: string
  mapping?: CategoryMapping
}

/**
 * Build monthly category totals from Splitwise expenses.
 */
export function mergeMonthlyCategoryTotals(
  splitwiseExpenses: NormalizedSplitwiseExpense[]
): MergedCategoryTotal[] {
  const merged = new Map<string, MergedCategoryTotal>()

  for (const swExpense of splitwiseExpenses) {
    const mapping = mapSplitwiseCategory(swExpense.category_name, swExpense.category_id)
    const bucketKey = getCategoryBucketKey(mapping)

    const existing = merged.get(bucketKey)

    if (existing) {
      // Add to existing category
      existing.total_amount += swExpense.user_owed_share
      existing.expense_count += 1
      existing.hasSplitwise = true
      existing.splitwise_count = (existing.splitwise_count || 0) + 1
    } else {
      merged.set(bucketKey, {
        category_id: mapping.category_id ?? bucketKey,
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
