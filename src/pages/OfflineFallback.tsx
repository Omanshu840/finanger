import { WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function OfflineFallback() {
  return (
    <div className="flex items-center justify-center min-h-screen px-4">
      <div className="text-center space-y-6 max-w-md">
        <div className="mx-auto w-16 h-16 rounded-full bg-yellow-500/10 flex items-center justify-center">
          <WifiOff className="h-8 w-8 text-yellow-600 dark:text-yellow-400" />
        </div>
        
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">You're Offline</h1>
          <p className="text-muted-foreground">
            Please check your internet connection and try again.
          </p>
        </div>

        <Button onClick={() => window.location.reload()}>
          Retry Connection
        </Button>
      </div>
    </div>
  )
}
