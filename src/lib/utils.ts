import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function isOnline(): boolean {
  return navigator.onLine
}

export function handleOfflineError(error: any) {
  if (!navigator.onLine) {
    return {
      error: 'You are currently offline. Changes will sync when you reconnect.',
      isOffline: true
    }
  }
  return {
    error: error.message || 'An error occurred',
    isOffline: false
  }
}
