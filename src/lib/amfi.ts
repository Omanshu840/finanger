export interface AMFIRecord {
  schemeCode: string
  isinGrowth?: string
  isinReinv?: string
  schemeName: string
  nav: number
  date: string // DD-MMM-YYYY format
}

export interface AMFIIndex {
  byISIN: Map<string, AMFIRecord>
  byNormalizedName: Map<string, AMFIRecord[]>
  records: AMFIRecord[]
  fetchedAt: number
}

const AMFI_URL = 'https://corsproxy.io/https://portal.amfiindia.com/spages/NAVAll.txt'

// In-memory cache only (no localStorage)
let memoryCache: AMFIIndex | null = null
const CACHE_DURATION = 24 * 60 * 60 * 1000 // 24 hours

/**
 * Fetch NAVAll.txt from AMFI
 */
export async function fetchNAVAll(): Promise<string> {
  try {
    const response = await fetch(AMFI_URL, {
      headers: {
        'Accept': 'text/plain'
      }
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    return await response.text()
  } catch (error: any) {
    console.error('AMFI fetch error:', error)
    throw new Error(`Failed to fetch AMFI NAV data: ${error.message}`)
  }
}

/**
 * Normalize scheme name for matching
 */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/&amp;/g, 'and')
    .replace(/&/g, 'and')
    .replace(/[^\w\s]/g, '')
}

/**
 * Parse NAVAll.txt into structured records
 */
export function parseNAVAll(raw: string): AMFIRecord[] {
  const lines = raw.split('\n')
  const records: AMFIRecord[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()

    if (!line) continue

    const parts = line.split(';')

    if (parts.length < 6) continue

    const [schemeCode, isinDiv, isinReinv, schemeName, navStr, dateStr] = parts.map(p => 
      p.trim().replace(/&amp;/g, '&')
    )

    const nav = parseFloat(navStr)
    if (isNaN(nav) || nav <= 0) continue

    if (!schemeCode || schemeCode.toLowerCase().includes('scheme')) continue

    records.push({
      schemeCode,
      isinGrowth: isinDiv || undefined,
      isinReinv: isinReinv || undefined,
      schemeName,
      nav,
      date: dateStr
    })
  }

  console.log(`📊 Parsed ${records.length} AMFI NAV records`)
  return records
}

/**
 * Build lookup indexes from records
 */
export function indexNAV(records: AMFIRecord[]): AMFIIndex {
  const byISIN = new Map<string, AMFIRecord>()
  const byNormalizedName = new Map<string, AMFIRecord[]>()

  for (const record of records) {
    if (record.isinGrowth) {
      byISIN.set(record.isinGrowth, record)
    }
    if (record.isinReinv) {
      byISIN.set(record.isinReinv, record)
    }

    const normalized = normalizeName(record.schemeName)
    const existing = byNormalizedName.get(normalized) || []
    existing.push(record)
    byNormalizedName.set(normalized, existing)
  }

  return {
    byISIN,
    byNormalizedName,
    records,
    fetchedAt: Date.now()
  }
}

/**
 * Lookup by ISIN
 */
export function lookupByISIN(index: AMFIIndex, isin: string): AMFIRecord | null {
  return index.byISIN.get(isin.toUpperCase()) || null
}

/**
 * Lookup by scheme name (fuzzy match)
 */
export function lookupByName(index: AMFIIndex, name: string): AMFIRecord[] {
  const normalized = normalizeName(name)
  
  const exact = index.byNormalizedName.get(normalized)
  if (exact && exact.length > 0) {
    return exact
  }

  const matches: AMFIRecord[] = []
  for (const [key, records] of index.byNormalizedName.entries()) {
    if (key.includes(normalized) || normalized.includes(key)) {
      matches.push(...records)
    }
  }

  return matches
}

/**
 * Get latest NAV from record
 */
export function getLatestNAV(record: AMFIRecord): { nav: number; date: string } {
  return {
    nav: record.nav,
    date: record.date
  }
}

/**
 * Ensure AMFI index is loaded (memory cache only)
 */
export async function ensureAMFIIndex(): Promise<AMFIIndex> {
  try {
    // Check memory cache
    if (memoryCache) {
      const age = Date.now() - memoryCache.fetchedAt
      if (age < CACHE_DURATION) {
        console.log('✅ Using in-memory AMFI cache')
        return memoryCache
      }
    }

    // Fetch and parse fresh data
    console.log('📥 Fetching fresh AMFI NAV data...')
    const raw = await fetchNAVAll()
    const records = parseNAVAll(raw)
    const index = indexNAV(records)

    // Store in memory cache
    memoryCache = index

    console.log('✅ AMFI index loaded in memory')
    return index
  } catch (error: any) {
    console.error('Failed to ensure AMFI index:', error)
    throw error
  }
}

/**
 * Clear AMFI cache
 */
export function clearAMFICache(): void {
  memoryCache = null
  console.log('🗑️ AMFI cache cleared')
}

/**
 * Check if AMFI index is cached
 */
export function isAMFICached(): boolean {
  if (!memoryCache) return false
  const age = Date.now() - memoryCache.fetchedAt
  return age < CACHE_DURATION
}

/**
 * Get cache age in minutes
 */
export function getCacheAge(): number | null {
  if (!memoryCache) return null
  const ageMs = Date.now() - memoryCache.fetchedAt
  return Math.floor(ageMs / 1000 / 60)
}
