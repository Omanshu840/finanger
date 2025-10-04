import { type AMFIIndex, type AMFIRecord, lookupByISIN, lookupByName } from './amfi'
import { type ParsedMFHolding } from './zerodhaParse'

export interface MFMatchResult {
  matchType: 'isin' | 'name' | 'manual' | 'none'
  matched?: AMFIRecord
  candidates?: AMFIRecord[]
}

/**
 * Map MF holding to AMFI record
 */
export function mapMFHoldingToAMFI(
  holding: ParsedMFHolding,
  amfiIndex: AMFIIndex
): MFMatchResult {
  // Try ISIN match first (preferred)
  if (holding.isin) {
    const matched = lookupByISIN(amfiIndex, holding.isin)
    if (matched) {
      return {
        matchType: 'isin',
        matched
      }
    }
  }

  // Try name match
  if (holding.schemeName) {
    const candidates = lookupByName(amfiIndex, holding.schemeName)

    if (candidates.length === 1) {
      return {
        matchType: 'name',
        matched: candidates[0]
      }
    } else if (candidates.length > 1) {
      return {
        matchType: 'name',
        candidates
      }
    }
  }

  return {
    matchType: 'none'
  }
}

/**
 * Compute MF valuation
 */
export function computeMFValue(units: number, nav: number): number {
  return units * nav
}
