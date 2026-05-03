import type { AMFIEntry, NavMap, NavEntryMap } from '@/features/investments/types/pricing.types'

// ── Search helpers (for scheme mapping UI) ───────────────────────────────────

/**
 * Find entries whose scheme name contains all query tokens (case-insensitive).
 * Used in the scheme code mapping UI when the user has a CAS scheme name
 * but no code yet.
 *
 * @example
 * searchByName(entryMap, 'nippon india small cap direct growth')
 * // → [{ schemeCode: '125497', schemeName: 'Nippon India Small Cap Fund...', nav: ... }]
 */
export function searchByName(
  entryMap: NavEntryMap,
  query: string,
  limit = 10,
): AMFIEntry[] {
  if (!query.trim()) return []

  // Tokenise query — drop short noise words
  const tokens = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 1)

  const results: AMFIEntry[] = []

  for (const entry of Object.values(entryMap)) {
    if (results.length >= limit) break

    const name = entry.name.toLowerCase()
    if (tokens.every((token) => name.includes(token))) {
      results.push(entry)
    }
  }

  return results
}

/**
 * Resolve a NAV by scheme code, with an optional name-based fallback.
 * Returns undefined if neither strategy finds a match.
 */
export function resolveNAV(
  navMap:    NavMap,
  entryMap:  NavEntryMap,
  schemeCode?: string,
  schemeName?: string,
): number | undefined {
  // Primary: exact scheme code match
  if (schemeCode && navMap[schemeCode] !== undefined) {
    return navMap[schemeCode]
  }

  // Fallback: first result from name search
  if (schemeName) {
    const matches = searchByName(entryMap, schemeName, 1)
    if (matches.length > 0) return matches[0].nav
  }

  return undefined
}
