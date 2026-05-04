import type { VercelRequest, VercelResponse } from '@vercel/node'

const SWIGGY_BASE_URL = 'https://www.swiggy.com'
const COOKIE_STORE_NAME = 'swiggy_cookies'

const ENDPOINT_MAP: Record<string, string> = {
  'signin-with-check': '/dapi/auth/signin-with-check',
  'otp-verify': '/dapi/auth/otp-verify',
  'order-all': '/dapi/order/all?order_id=',
}

function parseCookieHeader(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {}
  for (const part of cookieHeader.split(';')) {
    const [name, ...rest] = part.trim().split('=')
    if (!name) continue
    cookies[name] = decodeURIComponent(rest.join('='))
  }
  return cookies
}

function parseSetCookieLine(line: string): { name: string; value: string } | null {
  const [pair] = line.split(';')
  if (!pair) return null
  const [name, ...rest] = pair.split('=')
  if (!name) return null
  return { name: name.trim(), value: rest.join('=').trim() }
}

function encodeCookieStore(cookieStore: Record<string, string>) {
  return encodeURIComponent(JSON.stringify(cookieStore))
}

function decodeCookieStore(cookieValue: string) {
  try {
    return JSON.parse(decodeURIComponent(cookieValue) || '{}') as Record<string, string>
  } catch {
    return {}
  }
}

const debugHeaders = (headers: Record<string, string>) =>
  Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [
      key,
      key.toLowerCase() === 'cookie'
        ? value.split(';').slice(0, 5).join('; ')
        : value,
    ]),
  )

const base64UrlEncode = (value: string) =>
  Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

const createJwt = (payload: object) => {
  const header = { alg: 'HS256', typ: 'JWT', KID: '2' }
  const encodedHeader = base64UrlEncode(JSON.stringify(header))
  const encodedPayload = base64UrlEncode(JSON.stringify(payload))
  const signature = base64UrlEncode('signature')
  return `${encodedHeader}.${encodedPayload}.${signature}`
}

const ensureGuestCookieDefaults = (cookies: Record<string, string>) => {
  if (!cookies.__SW) {
    cookies.__SW = crypto.randomUUID().replace(/-/g, '').slice(0, 32)
  }
  if (!cookies._device_id) {
    cookies._device_id = crypto.randomUUID()
  }
  if (!cookies._sid) {
    cookies._sid = `r${crypto.randomUUID()}`
  }
  if (!cookies.fontsLoaded) {
    cookies.fontsLoaded = '1'
  }
  if (!cookies.userLocation) {
    cookies.userLocation = JSON.stringify({
      lat: '12.97530',
      lng: '77.59100',
      address: '',
      area: '',
      showUserDefaultAddressHint: false,
    })
  }
  if (!cookies._guest_tid) {
    cookies._guest_tid = createJwt({
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
      session_data: 'guest',
      sid: cookies._sid,
      user_id: '0',
    })
  }
  return cookies
}

const defaultSwiggyHeaders = {
  accept: '*/*',
  'accept-language': 'en-GB,en;q=0.5',
  'content-type': 'application/json',
  origin: 'https://www.swiggy.com',
  referer: 'https://www.swiggy.com/',
  platform: 'dweb',
  priority: 'u=1, i',
  __fetch_req__: 'true',
  'user-agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
  'user-id': '0',
  'sec-ch-ua': '"Chromium";v="146", "Not-A.Brand";v="24", "Brave";v="146"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"macOS"',
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-origin',
  'sec-gpc': '1',
}

const rootSwiggyHeaders = {
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'accept-language': 'en-GB,en;q=0.5',
  'cache-control': 'max-age=0',
  pragma: 'no-cache',
  origin: 'https://www.swiggy.com',
  referer: 'https://www.swiggy.com/',
  'upgrade-insecure-requests': '1',
  'user-agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
  'sec-ch-ua': '"Chromium";v="146", "Not-A.Brand";v="24", "Brave";v="146"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"macOS"',
  'sec-fetch-dest': 'document',
  'sec-fetch-mode': 'navigate',
  'sec-fetch-site': 'same-origin',
  'sec-fetch-user': '?1',
  'sec-gpc': '1',
}

const normalizeHeaderValue = (
  value: string | string[] | undefined,
  fallback: string,
) => {
  if (!value) return fallback
  return Array.isArray(value) ? value.join(', ') : value
}

const buildSwiggyHeaders = (req: VercelRequest, action: string) => {
  const headers: Record<string, string> = {
    ...defaultSwiggyHeaders,
    referer:
      action === 'order-all'
        ? 'https://www.swiggy.com/my-account/orders'
        : 'https://www.swiggy.com/',
    'user-agent': normalizeHeaderValue(req.headers['user-agent'], defaultSwiggyHeaders['user-agent']),
    'user-id': normalizeHeaderValue(req.headers['user-id'], '0'),
  }
  return headers
}

const buildRootHeaders = (req: VercelRequest) => {
  const headers: Record<string, string> = {
    ...rootSwiggyHeaders,
    'user-agent': normalizeHeaderValue(req.headers['user-agent'], rootSwiggyHeaders['user-agent']),
  }
  return headers
}

const getSetCookieHeaders = (response: Response) => {
  const raw = (response.headers as any).raw?.()['set-cookie'] as string[] | undefined
  if (Array.isArray(raw) && raw.length > 0) return raw
  const single = response.headers.get('set-cookie')
  return single ? [single] : []
}

async function ensureGuestCookies(
  req: VercelRequest,
  storedCookies: Record<string, string>,
  wafToken: string | null,
) {
  if (Object.keys(storedCookies).length > 0) {
    // If we have a fresh WAF token from the browser, always update it
    if (wafToken) {
      storedCookies['aws-waf-token'] = wafToken
      console.log('[swiggy-proxy] updated aws-waf-token from browser')
    }
    console.log('[swiggy-proxy] guest cookies already present', {
      count: Object.keys(storedCookies).length,
      keys: Object.keys(storedCookies),
      hasWafToken: !!storedCookies['aws-waf-token'],
    })
    return storedCookies
  }

  console.log('[swiggy-proxy] initializing guest cookies')
  const initHeaders = buildRootHeaders(req)

  // Inject WAF token into the homepage request if browser provided one
  if (wafToken) {
    initHeaders['x-aws-waf-token'] = wafToken
    console.log('[swiggy-proxy] injecting waf token into homepage init request')
  }

  const initResponse = await fetch(SWIGGY_BASE_URL, {
    method: 'GET',
    headers: initHeaders,
  })

  const guestCookies = getSetCookieHeaders(initResponse)

  console.log('[swiggy-proxy] guest init status', {
    status: initResponse.status,
    wafAction: initResponse.headers.get('x-amzn-waf-action') ?? 'none',
    guestCookieCount: guestCookies.length,
  })

  const newCookies = { ...storedCookies }
  for (const line of guestCookies) {
    const parsed = parseSetCookieLine(line)
    if (parsed) {
      newCookies[parsed.name] = parsed.value
    }
  }

  // Always inject the browser's WAF token — overrides whatever Swiggy set
  if (wafToken) {
    newCookies['aws-waf-token'] = wafToken
  }

  return ensureGuestCookieDefaults(newCookies)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = typeof req.headers.origin === 'string' ? req.headers.origin : ''
  const allowedOrigin = origin || 'http://localhost:5173'

  res.setHeader('Access-Control-Allow-Origin', allowedOrigin)
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Accept,Accept-Language,Content-Type,User-Agent,User-Id,Platform,Cookie,Priority,__fetch_req__,Sec-CH-UA,Sec-CH-UA-Mobile,Sec-CH-UA-Platform,Sec-Fetch-Site,Sec-Fetch-Mode,Sec-Fetch-Dest,Sec-Gpc,X-Swiggy-Waf-Token',
  )

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  const action = req.query.action
  if (!action || typeof action !== 'string') {
    return res.status(400).json({ error: 'Missing action query parameter' })
  }

  const endpoint = ENDPOINT_MAP[action]
  if (!endpoint) {
    return res.status(400).json({ error: 'Unsupported Swiggy action' })
  }

  let targetUrl = `${SWIGGY_BASE_URL}${endpoint}`
  if (action === 'order-all') {
    const orderId = typeof req.query.order_id === 'string' ? req.query.order_id : ''
    targetUrl += encodeURIComponent(orderId)
  }

  // ── WAF TOKEN ──────────────────────────────────────────────────────────────
  // Browser passes its Swiggy aws-waf-token via the x-swiggy-waf-token header.
  // We use a custom header name to avoid CORS preflight issues with x-aws-waf-token.
  const wafToken = normalizeHeaderValue(req.headers['x-swiggy-waf-token'], '') || null
  console.log('[swiggy-proxy] waf token present:', !!wafToken)
  // ──────────────────────────────────────────────────────────────────────────

  const incomingCookies = parseCookieHeader(req.headers.cookie ?? '')
  let savedSwiggyCookies = decodeCookieStore(incomingCookies[COOKIE_STORE_NAME] ?? '')
  savedSwiggyCookies = await ensureGuestCookies(req, savedSwiggyCookies, wafToken)

  const cookieHeader = Object.entries(savedSwiggyCookies)
    .map(([name, value]) => `${name}=${value}`)
    .join('; ')

  const headers = buildSwiggyHeaders(req, action)
  if (cookieHeader) {
    headers.Cookie = cookieHeader
  }

  // Also send as header in case cookie binding is checked
  if (wafToken) {
    headers['x-aws-waf-token'] = wafToken
  }

  console.log('[swiggy-proxy] outgoing request', {
    action,
    targetUrl,
    method: req.method,
    cookieNames: Object.keys(savedSwiggyCookies),
    hasWafToken: !!wafToken,
    requestHeaders: debugHeaders(headers),
  })

  const swiggyResponse = await fetch(targetUrl, {
    method: req.method,
    headers,
    body: req.method === 'POST' ? JSON.stringify(req.body ?? {}) : undefined,
  })

  const rawBody = await swiggyResponse.text()
  const swiggyCookies = getSetCookieHeaders(swiggyResponse)
  const updatedStore = { ...savedSwiggyCookies }

  const wafAction = swiggyResponse.headers.get('x-amzn-waf-action') ?? 'none'
  console.log('[swiggy-proxy] swiggy response', {
    status: swiggyResponse.status,
    wafAction,
    responseBodyPreview: rawBody.slice(0, 200),
  })

  // If WAF is still challenging, tell the frontend to refresh its token
  if (swiggyResponse.status === 202 && wafAction === 'challenge') {
    return res.status(401).json({
      error: 'WAF_CHALLENGE',
      message: 'Browser WAF token expired or invalid. Call AwsWafIntegration.getToken() and retry.',
    })
  }

  for (const line of swiggyCookies) {
    const parsed = parseSetCookieLine(line)
    if (parsed) {
      updatedStore[parsed.name] = parsed.value
    }
  }

  if (Object.keys(updatedStore).length > 0) {
    const isSecureOrigin =
      typeof req.headers.origin === 'string' && req.headers.origin.startsWith('https://')
    const cookieAttributes = [
      'Path=/',
      'SameSite=None',
      'HttpOnly',
      'Max-Age=86400',
      ...(isSecureOrigin ? ['Secure'] : []),
    ].join('; ')

    res.setHeader(
      'Set-Cookie',
      `${COOKIE_STORE_NAME}=${encodeCookieStore(updatedStore)}; ${cookieAttributes}`,
    )
  }

  const contentType = swiggyResponse.headers.get('content-type') ?? 'application/json'
  res.setHeader('Content-Type', contentType)
  res.status(swiggyResponse.status)
  return res.send(rawBody)
}