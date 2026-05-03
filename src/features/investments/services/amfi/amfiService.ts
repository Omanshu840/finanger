import type { FetchAMFIResult, AMFIProxyResponse, AMFIEntry } from '@/features/investments/types/pricing.types'
import { PROXY } from '../api/proxyConfig'

// ── In-memory cache ──────────────────────────────────────────────────────────

interface AMFICache {
  result:    FetchAMFIResult
  fetchedAt: number           // unix ms
}

let cache: AMFICache | null = null

const CACHE_TTL_MS = 15 * 60 * 1_000   // 15 minutes
const FETCH_TIMEOUT_MS = 10_000         // JSON response is small

// ── Helpers ──────────────────────────────────────────────────────────────────

function isCacheValid(): boolean {
  return cache !== null && Date.now() - cache.fetchedAt < CACHE_TTL_MS
}

async function fetchNavData(isins: string[]): Promise<AMFIProxyResponse> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const url = PROXY.amfi(isins)
    const response = await fetch(url, { signal: controller.signal })

    if (!response.ok) {
      throw new Error(`AMFI fetch failed: HTTP ${response.status} ${response.statusText}`)
    }

    return await response.json() as AMFIProxyResponse
  } finally {
    clearTimeout(timer)
  }
}

function transformToMaps(entries: AMFIEntry[]): FetchAMFIResult {
  const navMap = Object.create(null) as Record<string, number>
  const entryMap = Object.create(null) as Record<string, AMFIEntry>
  let asOf = ''

  for (const entry of entries) {
    navMap[entry.schemeCode] = entry.nav
    navMap[entry.isin] = entry.nav
    entryMap[entry.schemeCode] = entry
    entryMap[entry.isin] = entry
    if (entry.date) asOf = entry.date
  }

  return { navMap, entryMap, asOf }
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch AMFI NAV data for the given ISINs.
 *
 * - Returns cached result if fetched within the last 15 minutes
 * - Pass `force: true` to bypass the cache (e.g., manual "Refresh" click)
 * - Never throws — errors are propagated as rejected promises for the caller
 *   to handle (so the app can show "NAV fetch failed" gracefully)
 *
 * @param isins - Array of ISIN strings (e.g. ['INF846K01EH3', 'INF846K01K35'])
 * @param options - { force?: boolean } to bypass cache
 * @returns { navMap, entryMap, asOf }
 *
 * @example
 * const { navMap, entryMap, asOf } = await fetchAMFINav(['INF846K01EH3'])
 * navMap['119551']  // 104.5706
 */
export async function fetchAMFINav(
  isins: string[],
  options: { force?: boolean } = {},
): Promise<FetchAMFIResult> {
  // Skip empty ISIN list
  if (!isins || isins.length === 0) {
    console.warn('fetchAMFINav called with empty ISIN list');
    return { navMap: Object.create(null), entryMap: Object.create(null), asOf: '' }
  }

  if (!options.force && isCacheValid()) {
    return cache!.result
  }

  const response = await fetchNavData(isins)
  const result = transformToMaps(response.data)

  cache = { result, fetchedAt: Date.now() }

  return result
}

/**
 * Expose cache metadata for display ("NAV data as of 2026-04-29, cached 5m ago")
 */
export function getAMFICacheInfo(): { fetchedAt: number; asOf: string } | null {
  if (!cache) return null
  return { fetchedAt: cache.fetchedAt, asOf: cache.result.asOf }
}

/** Invalidate cache — useful for testing or forced refreshes */
export function clearAMFICache(): void {
  cache = null
}
