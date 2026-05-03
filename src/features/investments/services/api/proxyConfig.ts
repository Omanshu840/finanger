// Proxy URLs for API calls
// In production, the app and API are on the same domain (vercel.app)
// In development: use VITE_PROXY_BASE_URL env var
const BASE = import.meta.env.VITE_PROXY_BASE_URL ?? ''

if (!BASE && import.meta.env.DEV) {
  console.warn(
    '[proxyConfig] VITE_PROXY_BASE_URL is not set in development. ' +
    'Set it in .env.local or run: vercel dev',
  )
}

export const PROXY = {
  /** /api/proxy/yahoo?symbols=INFY.NS,TCS.NS */
  yahoo: (symbols: string[]) =>
    `${BASE}/api/proxy/yahoo?symbols=${symbols.map(encodeURIComponent).join(',')}`,

  /** /api/proxy/amfi?isin=INF846K01EH3,INF846K01K35 — returns NAV data for specific ISINs */
  amfi: (isins: string[]) =>
    `${BASE}/api/proxy/amfi?isin=${isins.map(encodeURIComponent).join(',')}`,
} as const