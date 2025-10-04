import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { handleSplitwiseCallback } from '@/lib/splitwiseAuth'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

export default function SplitwiseCallback() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  useEffect(() => {
    const processCallback = async () => {
      const code = searchParams.get('code')
      const state = searchParams.get('state')
      const error = searchParams.get('error')

      // Handle error
      if (error) {
        toast.error('Authorization failed', {
          description: searchParams.get('error_description') || error
        })
        navigate('/settings/profile', { replace: true })
        return
      }

      // Validate parameters
      if (!code || !state) {
        toast.error('Invalid callback', {
          description: 'Missing authorization code or state'
        })
        navigate('/settings/profile', { replace: true })
        return
      }

      // Exchange code for token
      const result = await handleSplitwiseCallback(code, state)

      if (result.success) {
        toast.success('Splitwise connected!', {
          description: 'You can now view your shared expenses'
        })
      } else {
        toast.error('Failed to connect', {
          description: result.error
        })
      }

      navigate('/settings/profile', { replace: true })
    }

    processCallback()
  }, [navigate, searchParams])

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center space-y-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
        <div>
          <h2 className="text-xl font-semibold mb-2">Connecting to Splitwise</h2>
          <p className="text-muted-foreground">Please wait...</p>
        </div>
      </div>
    </div>
  )
}
