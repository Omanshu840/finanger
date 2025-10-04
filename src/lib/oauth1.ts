/**
 * OAuth 1.0 signature utilities for Splitwise
 */

/**
 * Generate OAuth nonce (random string)
 */
export function generateNonce(): string {
  const array = new Uint8Array(16)
  crypto.getRandomValues(array)
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * Get current timestamp in seconds
 */
export function getTimestamp(): string {
  return Math.floor(Date.now() / 1000).toString()
}

/**
 * Percent encode according to RFC 3986
 */
export function percentEncode(str: string): string {
  return encodeURIComponent(str)
    .replace(/!/g, '%21')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
    .replace(/\*/g, '%2A')
}

/**
 * Create OAuth signature base string
 */
export function createSignatureBaseString(
  method: string,
  url: string,
  params: Record<string, string>
): string {
  // Sort parameters alphabetically
  const sortedKeys = Object.keys(params).sort()
  const paramString = sortedKeys
    .map(key => `${percentEncode(key)}=${percentEncode(params[key])}`)
    .join('&')

  return [
    method.toUpperCase(),
    percentEncode(url),
    percentEncode(paramString)
  ].join('&')
}

/**
 * Generate HMAC-SHA1 signature
 */
export async function generateSignature(
  baseString: string,
  consumerSecret: string,
  tokenSecret: string = ''
): Promise<string> {
  const key = `${percentEncode(consumerSecret)}&${percentEncode(tokenSecret)}`
  
  const encoder = new TextEncoder()
  const keyData = encoder.encode(key)
  const messageData = encoder.encode(baseString)

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  )

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData)
  
  // Convert to base64
  return btoa(String.fromCharCode(...new Uint8Array(signature)))
}

/**
 * Create OAuth authorization header
 */
export function createAuthorizationHeader(params: Record<string, string>): string {
  const sortedKeys = Object.keys(params).sort()
  const headerParams = sortedKeys
    .map(key => `${percentEncode(key)}="${percentEncode(params[key])}"`)
    .join(', ')
  
  return `OAuth ${headerParams}`
}

/**
 * Parse query string into object
 */
export function parseQueryString(queryString: string): Record<string, string> {
  const params: Record<string, string> = {}
  const pairs = queryString.split('&')
  
  for (const pair of pairs) {
    const [key, value] = pair.split('=')
    if (key) {
      params[decodeURIComponent(key)] = decodeURIComponent(value || '')
    }
  }
  
  return params
}
