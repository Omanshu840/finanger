import { useEffect, useState } from 'react'
import { useAuth } from '@/providers/AuthProvider'
import { checkAndSeedUserData } from '@/data/seed'
import { toast } from 'sonner'

/**
 * Hook to automatically seed user data on first app load
 */
export function useAutoSeed() {
  const { user } = useAuth()
  const [hasChecked, setHasChecked] = useState(false)

  useEffect(() => {
    if (!user || hasChecked) return

    const seedData = async () => {
      try {
        const wasSeeded = await checkAndSeedUserData(user.id)
        
        if (wasSeeded) {
          toast.success('Welcome! 🎉', {
            description: 'We\'ve set up some default categories and accounts to get you started.',
            duration: 5000
          })
        }
        
        setHasChecked(true)
      } catch (error) {
        console.error('Auto-seed error:', error)
        setHasChecked(true)
      }
    }

    // Small delay to ensure user session is fully established
    const timer = setTimeout(seedData, 500)

    return () => clearTimeout(timer)
  }, [user, hasChecked])
}
