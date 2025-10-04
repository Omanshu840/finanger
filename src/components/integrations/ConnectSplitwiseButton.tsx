import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { startSplitwiseAuth, disconnectSplitwise, getAuthStatus } from '@/lib/splitwiseAuth'
import { splitwiseClient } from '@/lib/splitwiseApi'
import { toast } from 'sonner'
import { Loader2, RefreshCw, ExternalLink, LogOut } from 'lucide-react'

export default function ConnectSplitwiseButton() {
  const [isConnected, setIsConnected] = useState(false)
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<{ first_name: string; last_name: string; email: string } | null>(null)
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    checkConnection()
  }, [])

  const checkConnection = async () => {
    setLoading(true)
    try {
      const status = await getAuthStatus()
      setIsConnected(status.isAuthenticated)
      setUser(status.user || null)
    } catch (error) {
      console.error('Error checking Splitwise connection:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleConnect = async () => {
    try {
      await startSplitwiseAuth()
    } catch (error: any) {
      toast.error('Failed to connect', {
        description: error.message
      })
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      const userData = await splitwiseClient.getCurrentUser()
      setUser(userData)
      toast.success('Refreshed Splitwise data')
    } catch (error: any) {
      if (error.message === 'UNAUTHORIZED') {
        toast.error('Session expired', {
          description: 'Please reconnect your Splitwise account'
        })
        await disconnectSplitwise()
        setIsConnected(false)
        setUser(null)
      } else {
        toast.error('Failed to refresh', {
          description: error.message
        })
      }
    } finally {
      setRefreshing(false)
    }
  }

  const handleDisconnect = async () => {
    await disconnectSplitwise()
    setIsConnected(false)
    setUser(null)
    setShowDisconnectDialog(false)
    toast.info('Disconnected from Splitwise')
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                Splitwise Integration
                {isConnected && (
                  <Badge variant="secondary" className="bg-green-500/10 text-green-700 dark:text-green-400">
                    Connected
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                {isConnected
                  ? 'View and track your shared expenses'
                  : 'Connect to import your Splitwise expenses'
                }
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {!isConnected ? (
            <>
              <div className="rounded-lg border border-dashed p-4 text-center">
                <Button onClick={handleConnect} className="w-full sm:w-auto">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Connect Splitwise
                </Button>
              </div>
            </>
          ) : (
            <>
              {user && (
                <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                  <div>
                    <p className="font-medium">
                      {user.first_name} {user.last_name}
                    </p>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={handleRefresh}
                  disabled={refreshing}
                  variant="outline"
                  size="sm"
                >
                  {refreshing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Refreshing...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Refresh
                    </>
                  )}
                </Button>

                <Button
                  onClick={() => setShowDisconnectDialog(true)}
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Disconnect
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Disconnect Confirmation */}
      <AlertDialog open={showDisconnectDialog} onOpenChange={setShowDisconnectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Splitwise?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove your Splitwise connection and clear stored tokens. You can reconnect anytime.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDisconnect} className="bg-destructive text-destructive-foreground">
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
