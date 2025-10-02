import { useEffect, useState } from 'react'
import { toast } from 'sonner'

export default function UpdatePrompt() {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null)

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then((reg) => {
        setRegistration(reg)

        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing
          
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                toast.info('Update Available', {
                  description: 'A new version is available. Click to update.',
                  action: {
                    label: 'Update',
                    onClick: () => handleUpdate()
                  },
                  duration: Infinity
                })
              }
            })
          }
        })
      })
    }
  }, [])

  const handleUpdate = () => {
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' })
      
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload()
      })
    }
  }

  return null
}
