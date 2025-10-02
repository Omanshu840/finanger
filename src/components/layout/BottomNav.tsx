import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Receipt,
  TrendingUp,
  Settings
} from 'lucide-react'

const routes = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
  { label: 'Expenses', icon: Receipt, href: '/expenses' },
  { label: 'Investments', icon: TrendingUp, href: '/investments' },
  { label: 'Settings', icon: Settings, href: '/settings' }
]

export default function BottomNav() {
  const location = useLocation()

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex justify-around items-center h-16 px-2">
        {routes.map((route) => {
          const isActive = location.pathname === route.href
          return (
            <Link
              key={route.href}
              to={route.href}
              className={cn(
                'flex flex-col items-center justify-center gap-1 flex-1 h-full rounded-md transition-colors',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              aria-label={route.label}
              aria-current={isActive ? 'page' : undefined}
            >
              <route.icon className="h-5 w-5" />
              <span className="text-xs font-medium">{route.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
