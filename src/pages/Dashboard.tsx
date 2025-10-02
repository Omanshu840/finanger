import { useEffect, useState } from 'react'
import { isOnline } from '@/lib/utils'
import { WifiOff } from 'lucide-react'

export default function Dashboard() {
  const [online, setOnline] = useState(isOnline())

  useEffect(() => {
    const handleOnline = () => setOnline(true)
    const handleOffline = () => setOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return (
    <div className="space-y-6">
      {!online && (
        <div className="flex items-center gap-2 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
          <WifiOff className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            You're offline. Changes will sync when reconnected.
          </p>
        </div>
      )}

      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome to your financial overview
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-sm font-medium text-muted-foreground">
            Total Balance
          </h3>
          <p className="text-2xl font-bold mt-2">$12,345</p>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-sm font-medium text-muted-foreground">
            Monthly Expenses
          </h3>
          <p className="text-2xl font-bold mt-2">$2,456</p>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-sm font-medium text-muted-foreground">
            Investments
          </h3>
          <p className="text-2xl font-bold mt-2">$8,920</p>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-sm font-medium text-muted-foreground">
            Savings
          </h3>
          <p className="text-2xl font-bold mt-2">$4,532</p>
        </div>
      </div>
    </div>
  )
}
