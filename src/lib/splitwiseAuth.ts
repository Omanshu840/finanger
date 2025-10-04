import { storeTokens, getTokens, clearTokens } from './tokenStorage'

const SPLITWISE_AUTHORIZE_URL = 'https://secure.splitwise.com/oauth/authorize'
const SPLITWISE_TOKEN_URL = 'https://corsproxy.io/https://secure.splitwise.com/oauth/token'
const CLIENT_ID = import.meta.env.VITE_SPLITWISE_CLIENT_ID
const CLIENT_SECRET = import.meta.env.VITE_SPLITWISE_CLIENT_SECRET
const REDIRECT_URI = import.meta.env.VITE_SPLITWISE_REDIRECT_URI

/**
 * Generate random state for CSRF protection
 */
function generateState(): string {
  const array = new Uint8Array(16)
  crypto.getRandomValues(array)
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * Start OAuth 2.0 authorization flow
 */
export async function startSplitwiseAuth(): Promise<void> {
  if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
    throw new Error('Splitwise OAuth credentials not configured')
  }

  // Generate and store state
  const state = generateState()
  sessionStorage.setItem('splitwise_oauth_state', state)

  // Build authorization URL
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    state
  })

  const authUrl = `${SPLITWISE_AUTHORIZE_URL}?${params.toString()}`
  
  // Redirect to Splitwise
  window.location.href = authUrl
}

/**
 * Handle OAuth callback and exchange code for token
 */
export async function handleSplitwiseCallback(
  code: string,
  state: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Validate state
    const storedState = sessionStorage.getItem('splitwise_oauth_state')
    if (!storedState || state !== storedState) {
      return { success: false, error: 'Invalid state parameter (CSRF protection)' }
    }

    // Clear state
    sessionStorage.removeItem('splitwise_oauth_state')

    // Exchange code for access token
    const tokenParams = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET
    })

    const response = await fetch(SPLITWISE_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: tokenParams.toString()
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Token exchange error:', errorText)
      
      try {
        const errorData = JSON.parse(errorText)
        return { 
          success: false, 
          error: errorData.error_description || errorData.error || 'Failed to get access token' 
        }
      } catch {
        return { success: false, error: `HTTP ${response.status}: ${errorText}` }
      }
    }

    const tokenData = await response.json()

    if (!tokenData.access_token) {
      return { success: false, error: 'No access token in response' }
    }

    // Calculate expiration if provided
    const expiresAt = tokenData.expires_in 
      ? Date.now() + tokenData.expires_in * 1000 
      : undefined

    // Store tokens
    await storeTokens({
      access_token: tokenData.access_token,
      token_type: tokenData.token_type || 'Bearer',
      expires_at: expiresAt
    })

    return { success: true }
  } catch (error: any) {
    console.error('OAuth callback error:', error)
    return { success: false, error: error.message || 'Unknown error' }
  }
}

/**
 * Get authentication status
 */
export async function getAuthStatus(): Promise<{
  isAuthenticated: boolean
  user?: { id: number; email: string; first_name: string; last_name: string }
}> {
  const tokens = await getTokens()
  
  if (!tokens) {
    return { isAuthenticated: false }
  }

  return {
    isAuthenticated: true,
    user: tokens.user
  }
}

/**
 * Disconnect Splitwise
 */
export async function disconnectSplitwise(): Promise<void> {
  await clearTokens()
  sessionStorage.removeItem('splitwise_oauth_state')
}
