import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

export default function AuthCallback() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get the code from URL
        const code = searchParams.get('code')
        const error = searchParams.get('error')
        const errorDescription = searchParams.get('error_description')

        if (error) {
          toast.error('Authentication failed', {
            description: errorDescription || error
          })
          navigate('/auth', { replace: true })
          return
        }

        if (code) {
          // Exchange code for session
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
          
          if (exchangeError) {
            toast.error('Failed to complete sign in', {
              description: exchangeError.message
            })
            navigate('/auth', { replace: true })
            return
          }

          toast.success('Successfully signed in!')
          navigate('/dashboard', { replace: true })
        } else {
          // No code present, redirect to auth
          navigate('/auth', { replace: true })
        }
      } catch (err) {
        console.error('Callback error:', err)
        toast.error('An unexpected error occurred')
        navigate('/auth', { replace: true })
      }
    }

    handleCallback()
  }, [navigate, searchParams])

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
        <p className="text-muted-foreground">Completing sign in...</p>
      </div>
    </div>
  )
}
