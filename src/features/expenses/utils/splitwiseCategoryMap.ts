export interface CategoryMapping {
  category_id?: string
  ui_name: string
  color: string
  is_virtual: boolean
}

const SPLITWISE_CATEGORY_COLORS = [
  '#10b981',
  '#3b82f6',
  '#f59e0b',
  '#ec4899',
  '#8b5cf6',
  '#14b8a6',
  '#ef4444',
  '#06b6d4',
  '#84cc16',
  '#f97316',
]

function hashCategory(categoryName: string, categoryId?: number): number {
  const value = `${categoryId ?? ''}:${categoryName}`

  return Array.from(value).reduce((hash, char) => {
    return (hash * 31 + char.charCodeAt(0)) >>> 0
  }, 0)
}

export function getSplitwiseCategoryColor(categoryName: string, categoryId?: number): string {
  const index = hashCategory(categoryName, categoryId) % SPLITWISE_CATEGORY_COLORS.length
  return SPLITWISE_CATEGORY_COLORS[index]
}

/**
 * Splitwise is the source of truth for expense categories. Supabase should not
 * be queried for category mappings.
 */
export function mapSplitwiseCategory(
  splitwiseCategoryName: string,
  splitwiseCategoryId?: number
): CategoryMapping {
  return {
    category_id: `splitwise-${splitwiseCategoryId ?? splitwiseCategoryName.toLowerCase().trim()}`,
    ui_name: splitwiseCategoryName,
    color: getSplitwiseCategoryColor(splitwiseCategoryName, splitwiseCategoryId),
    is_virtual: false
  }
}

/**
 * Get bucket key for a category mapping
 */
export function getCategoryBucketKey(mapping: CategoryMapping): string {
  return mapping.category_id || `sw_${mapping.ui_name.toLowerCase().replace(/\s+/g, '_')}`
}
