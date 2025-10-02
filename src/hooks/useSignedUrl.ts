import { useState, useEffect } from 'react'
import { getReceiptUrl } from '@/lib/storage'

/**
 * Hook to fetch and auto-refresh signed URLs
 * Refetches when component becomes visible or on mount
 */
export function useSignedUrl(path: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchUrl = async () => {
    if (!path) {
      setUrl(null)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const signedUrl = await getReceiptUrl(path)
      setUrl(signedUrl)
    } catch (err: any) {
      setError(err.message || 'Failed to load receipt')
      setUrl(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUrl()
  }, [path])

  // Refetch when page becomes visible (handles expiration)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && path) {
        fetchUrl()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [path])

  return { url, loading, error, refetch: fetchUrl }
}
