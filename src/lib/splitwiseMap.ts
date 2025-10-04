export interface CategoryMapping {
  category_id?: string
  ui_name: string
  color: string
  is_virtual: boolean
}

// Virtual Splitwise category for unmapped items
export const SPLITWISE_VIRTUAL_CATEGORY: CategoryMapping = {
  ui_name: 'Splitwise (Unmapped)',
  color: '#10b981',
  is_virtual: true
}

/**
 * Map Splitwise category name to local category
 * TODO: Add user-defined mappings in settings
 */
export function mapSplitwiseCategory(
  splitwiseCategoryName: string,
  localCategories: Array<{ id: string; name: string; color: string }>
): CategoryMapping {
  const normalized = splitwiseCategoryName.toLowerCase().trim()

  // Try exact match (case-insensitive)
  const match = localCategories.find(
    cat => cat.name.toLowerCase().trim() === normalized
  )

  if (match) {
    return {
      category_id: match.id,
      ui_name: match.name,
      color: match.color,
      is_virtual: false
    }
  }

  // Common mappings
  const commonMappings: Record<string, string[]> = {
    'groceries': ['groceries', 'food', 'grocery'],
    'dining out': ['restaurant', 'dining', 'food and drink', 'dining out'],
    'entertainment': ['entertainment', 'movies', 'games'],
    'transportation': ['transportation', 'car', 'gas', 'transit', 'taxi', 'uber'],
    'utilities': ['utilities', 'electricity', 'gas', 'water'],
    'shopping': ['shopping', 'general'],
    'healthcare': ['healthcare', 'medical', 'pharmacy'],
    'travel': ['travel', 'vacation', 'hotel']
  }

  // Try fuzzy match
  for (const [localName, splitwiseAliases] of Object.entries(commonMappings)) {
    if (splitwiseAliases.some(alias => normalized.includes(alias))) {
      const matchedCategory = localCategories.find(
        cat => cat.name.toLowerCase().includes(localName)
      )
      
      if (matchedCategory) {
        return {
          category_id: matchedCategory.id,
          ui_name: matchedCategory.name,
          color: matchedCategory.color,
          is_virtual: false
        }
      }
    }
  }

  // No match - return virtual category
  return {
    ...SPLITWISE_VIRTUAL_CATEGORY,
    ui_name: `${splitwiseCategoryName} (Splitwise)`
  }
}

/**
 * Get bucket key for a category mapping
 */
export function getCategoryBucketKey(mapping: CategoryMapping): string {
  return mapping.category_id || `sw_${mapping.ui_name.toLowerCase().replace(/\s+/g, '_')}`
}
