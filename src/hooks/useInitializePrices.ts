import { useEffect } from 'react'
import { usePriceRefresh } from '@/features/investments/pricing/hooks/usePriceRefresh'

/**
 * Initialize and fetch all prices on app load.
 * Runs once when the component mounts (empty dependency array).
 * 
 * @example
 * export function AppLayout() {
 *   useInitializePrices()  // Call at root level
 *   return (...)
 * }
 */
export function useInitializePrices() {
  const { refresh } = usePriceRefresh()

  useEffect(() => {
    // Fetch prices on first load only
    const initializePrices = async () => {
      try {
        const summary = await refresh()
        if (summary) {
          console.debug('[useInitializePrices] Price fetch summary:', {
            stocksUpdated: summary.stocksUpdated,
            mfUpdated: summary.mfUpdated,
            hasErrors: Object.keys(summary.errors.stocks).length > 0 || summary.errors.mf.length > 0,
          })
        }
      } catch (error) {
        console.error('[useInitializePrices] Failed to initialize prices:', error)
      }
    }

    initializePrices()
  }, [])  // Empty dependency array — runs only once on mount
}
