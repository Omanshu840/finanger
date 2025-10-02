import { Outlet, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Header from './Header'
import Sidebar from './Sidebar'
import BottomNav from './BottomNav'
import AuthGuard from '@/components/auth/AuthGuard'
import UpdatePrompt from '@/components/pwa/UpdatePrompt'
import { ThemeProvider } from '@/components/theme/ThemeProvider'
import { useAutoSeed } from '@/hooks/useAutoSeed'

export default function AppShell() {
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const isAuthPage = location.pathname === '/auth'

  // Auto-seed data for new users
  useAutoSeed()

  // Keyboard shortcut to toggle sidebar (Cmd/Ctrl + B)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault()
        setSidebarOpen(prev => !prev)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  if (isAuthPage) {
    return (
      <ThemeProvider defaultTheme="system" storageKey="finance-app-theme">
        <div className="min-h-dvh flex bg-background text-foreground">
          <Outlet />
        </div>
      </ThemeProvider>
    )
  }

  return (
    <ThemeProvider defaultTheme="system" storageKey="finance-app-theme">
      <AuthGuard>
        <UpdatePrompt />
        <div className="min-h-dvh flex bg-background text-foreground">
          <Sidebar open={sidebarOpen} onOpenChange={setSidebarOpen} />
          
          <div className="flex-1 flex flex-col md:ml-64 lg:ml-72">
            <Header onMenuClick={() => setSidebarOpen(true)} />
            
            <main className="flex-1 p-3 sm:p-4 md:p-6 pb-20 md:pb-6">
              <Outlet />
            </main>
            
            <BottomNav />
          </div>
        </div>
      </AuthGuard>
    </ThemeProvider>
  )
}
