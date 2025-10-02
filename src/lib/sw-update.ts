import { toast } from 'sonner'

export function registerSWUpdatePrompt() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').then((registration) => {
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing
        
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              toast.info('Update Available', {
                description: 'Click to refresh and get the latest version',
                action: {
                  label: 'Refresh',
                  onClick: () => {
                    newWorker.postMessage({ type: 'SKIP_WAITING' })
                    window.location.reload()
                  }
                },
                duration: Infinity
              })
            }
          })
        }
      })
    }).catch((error) => {
      console.error('Service Worker registration failed:', error)
    })
  }
}

// For manual update checks
export async function checkForUpdates(registration?: ServiceWorkerRegistration) {
  if (!registration) {
    registration = await navigator.serviceWorker.getRegistration()
  }
  
  if (registration) {
    await registration.update()
  }
}
