import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/providers/AuthProvider'

interface AuthGuardProps {
  children: React.ReactNode
  requireAuth?: boolean
}

export default function AuthGuard({ children, requireAuth = true }: AuthGuardProps) {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    if (loading) return

    if (requireAuth && !user) {
      // Redirect to auth if not authenticated
      navigate('/auth', { 
        replace: true, 
        state: { from: location.pathname } 
      })
    } else if (!requireAuth && user) {
      // Redirect to dashboard if already authenticated
      const from = (location.state as any)?.from || '/dashboard'
      navigate(from, { replace: true })
    } else {
      setIsChecking(false)
    }
  }, [user, loading, requireAuth, navigate, location])

  if (loading || isChecking) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  return <>{children}</>
}
