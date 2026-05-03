import { useLocation } from 'react-router-dom'

const ROUTE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/assets': 'Assets',
  '/import': 'Import',
  '/settings': 'Settings',
}

export function usePageTitle(): string {
  const { pathname } = useLocation()

  // Exact match first
  if (ROUTE_TITLES[pathname]) return ROUTE_TITLES[pathname]

  // Prefix match for nested routes (/assets/123 → "Assets")
  const prefix = Object.keys(ROUTE_TITLES).find(
    (route) => route !== '/' && pathname.startsWith(route),
  )

  return prefix ? ROUTE_TITLES[prefix] : 'Dashboard'
}