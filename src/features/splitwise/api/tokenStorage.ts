interface TokenData {
  access_token: string
  token_type: string
  expires_at?: number
  user?: {
    id: number
    email: string
    first_name: string
    last_name: string
  }
}

const DB_NAME = 'finance-app-tokens'
const STORE_NAME = 'splitwise-oauth2'
const DB_VERSION = 3

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

export async function storeTokens(tokens: TokenData): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.put(tokens, 'tokens')

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}

export async function getTokens(): Promise<TokenData | null> {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.get('tokens')

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const tokens = request.result as TokenData | undefined
        
        // Check if token is expired
        if (tokens && tokens.expires_at && tokens.expires_at < Date.now()) {
          resolve(null)
        } else {
          resolve(tokens || null)
        }
      }
    })
  } catch (error) {
    console.error('Error getting tokens:', error)
    return null
  }
}

export async function clearTokens(): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.delete('tokens')

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}

interface CachedUser {
  user: {
    id: number
    email: string
    first_name: string
    last_name: string
  }
  cached_at: number
}

const USER_CACHE_DURATION = 24 * 60 * 60 * 1000 // 24 hours

/**
 * Cache current user info
 */
export async function cacheCurrentUser(user: {
  id: number
  email: string
  first_name: string
  last_name: string
}): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    
    const cachedUser: CachedUser = {
      user,
      cached_at: Date.now()
    }
    
    const request = store.put(cachedUser, 'current_user')

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}

/**
 * Get cached current user
 */
export async function getCachedCurrentUser(): Promise<CachedUser['user'] | null> {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.get('current_user')

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const cached = request.result as CachedUser | undefined
        
        if (!cached) {
          resolve(null)
          return
        }

        // Check if cache is still valid
        const age = Date.now() - cached.cached_at
        if (age > USER_CACHE_DURATION) {
          resolve(null)
          return
        }

        resolve(cached.user)
      }
    })
  } catch (error) {
    console.error('Error getting cached user:', error)
    return null
  }
}

/**
 * Clear cached user
 */
export async function clearCachedUser(): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.delete('current_user')

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}
