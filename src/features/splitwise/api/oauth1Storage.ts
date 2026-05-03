interface OAuth1Tokens {
  oauth_token: string
  oauth_token_secret: string
  user?: {
    id: number
    email: string
    first_name: string
    last_name: string
  }
}

const DB_NAME = 'finance-app-tokens'
const STORE_NAME = 'splitwise-oauth1'
const DB_VERSION = 2

/**
 * Open IndexedDB connection
 */
async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
  })
}

/**
 * Store OAuth tokens
 */
export async function storeOAuth1Tokens(tokens: OAuth1Tokens): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.put(tokens, 'tokens')

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}

/**
 * Get OAuth tokens
 */
export async function getOAuth1Tokens(): Promise<OAuth1Tokens | null> {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.get('tokens')

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result || null)
    })
  } catch (error) {
    console.error('Error getting OAuth tokens:', error)
    return null
  }
}

/**
 * Clear OAuth tokens
 */
export async function clearOAuth1Tokens(): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.delete('tokens')

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}

/**
 * Store temporary request token
 */
export function storeTempRequestToken(token: string, secret: string): void {
  sessionStorage.setItem('oauth_request_token', token)
  sessionStorage.setItem('oauth_request_token_secret', secret)
}

/**
 * Get temporary request token
 */
export function getTempRequestToken(): { token: string; secret: string } | null {
  const token = sessionStorage.getItem('oauth_request_token')
  const secret = sessionStorage.getItem('oauth_request_token_secret')
  
  if (!token || !secret) return null
  
  return { token, secret }
}

/**
 * Clear temporary request token
 */
export function clearTempRequestToken(): void {
  sessionStorage.removeItem('oauth_request_token')
  sessionStorage.removeItem('oauth_request_token_secret')
}
