const BASE = import.meta.env.VITE_PROXY_BASE_URL ?? ''

if (!BASE && import.meta.env.DEV) {
  console.warn(
    '[proxy] VITE_PROXY_BASE_URL is not set in development. ' +
      'Use /api/proxy routes directly or set VITE_PROXY_BASE_URL when running vercel dev.',
  )
}

export const SWIGGY_PROXY_URL = (action: string, query = '') => {
  const queryString = query ? `&${query}` : ''
  return `${BASE}/api/proxy/swiggy?action=${encodeURIComponent(action)}${queryString}`
}
