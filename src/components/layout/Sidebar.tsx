import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Receipt,
  TrendingUp,
  Settings,
} from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'

interface SidebarProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

const routes = [
  {
    label: 'Dashboard',
    icon: LayoutDashboard,
    href: '/dashboard',
    color: 'text-sky-500'
  },
  {
    label: 'Expenses',
    icon: Receipt,
    href: '/expenses',
    color: 'text-violet-500'
  },
  {
    label: 'Investments',
    icon: TrendingUp,
    href: '/investments',
    color: 'text-pink-700'
  },
  {
    label: 'Settings',
    icon: Settings,
    href: '/settings',
    color: 'text-orange-500'
  }
]

function SidebarContent() {
  const location = useLocation()

  return (
    <div className="space-y-4 py-4">
      <div className="px-3 py-2">
        <h2 className="mb-2 px-4 text-xl font-semibold tracking-tight">
          Finance Tracker
        </h2>
        <div className="space-y-1">
          {routes.map((route) => (
            <Link
              key={route.href}
              to={route.href}
              className={cn(
                'group flex items-center rounded-md px-3 py-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors',
                location.pathname === route.href
                  ? 'bg-accent text-accent-foreground'
                  : 'transparent'
              )}
            >
              <route.icon className={cn('mr-3 h-5 w-5', route.color)} />
              <span>{route.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function Sidebar({ open, onOpenChange }: SidebarProps) {
  return (
    <>
      {/* Mobile */}
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="left" className="p-0 w-72">
          <SheetHeader className="p-4 border-b">
            <SheetTitle>Menu</SheetTitle>
          </SheetHeader>
          <SidebarContent />
        </SheetContent>
      </Sheet>

      {/* Desktop */}
      <aside className="hidden md:flex md:w-64 lg:w-72 flex-col fixed inset-y-0 z-50 border-r bg-card">
        <SidebarContent />
      </aside>
    </>
  )
}
