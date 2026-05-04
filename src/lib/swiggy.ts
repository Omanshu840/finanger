import { SWIGGY_PROXY_URL } from '@/lib/proxy'

export interface SwiggySession {
  mobile: string
  customerId?: string
  token: string
  sid?: string
  deviceId?: string
  csrfToken?: string | null
  createdAt: number
}

const STORAGE_KEY = 'swiggy_session'

// load challenge.js from swiggy.com's WAF
const SWIGGY_WAF_SCRIPT = 'https://b67f7794189c.edge.sdk.awswaf.com/b67f7794189c/3dddb029b68f/challenge.js'
let tokenPromise: Promise<string> | null = null

export async function getSwiggyWafToken(): Promise<string> {
  if (!tokenPromise) {
    tokenPromise = new Promise((resolve, reject) => {
      if ((window as any).AwsWafIntegration) {
        (window as any).AwsWafIntegration.getToken().then(resolve).catch(reject)
        return
      }
      const script = document.createElement('script')
      script.src = SWIGGY_WAF_SCRIPT
      script.onload = () => (window as any).AwsWafIntegration.getToken().then(resolve).catch(reject)
      script.onerror = reject
      document.head.appendChild(script)
    })
  }
  return tokenPromise
}

export function resetWafToken() { tokenPromise = null }

export function getSwiggySession(): SwiggySession | null {
  if (typeof window === 'undefined') {
    return null
  }

  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw) as SwiggySession
  } catch {
    window.localStorage.removeItem(STORAGE_KEY)
    return null
  }
}

export function saveSwiggySession(session: SwiggySession) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
}

export function clearSwiggySession() {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.removeItem(STORAGE_KEY)
}

async function proxyFetch(path: string, options: RequestInit = {}) {
  const wafToken = await getSwiggyWafToken()

  const response = await fetch(path, {
    ...options,
    mode: 'cors',
    credentials: 'include',
    headers: {
      accept: '*/*',
      'content-type': 'application/json',
      'x-swiggy-waf-token': wafToken,
      platform: 'dweb',
      'user-id': '0',
      ...(options.headers ?? {}),
    },
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Swiggy proxy request failed: ${response.status} ${response.statusText} ${body}`)
  }

  return response.json()
}

export async function requestSwiggyOtp(mobile: string) {
  return proxyFetch(SWIGGY_PROXY_URL('signin-with-check'), {
    method: 'POST',
    body: JSON.stringify({
      mobile,
      password: '',
      _csrf: '',
    }),
  })
}

export async function verifySwiggyOtp(otp: string): Promise<SwiggySession> {
  const json = await proxyFetch(SWIGGY_PROXY_URL('otp-verify'), {
    method: 'POST',
    body: JSON.stringify({
      otp,
      _csrf: '',
    }),
  })

  if (json?.statusCode !== 0) {
    throw new Error(json?.statusMessage || 'Unable to verify Swiggy OTP')
  }

  const data = json.data
  if (!data?.token) {
    throw new Error('Swiggy OTP verification succeeded but no token was returned')
  }

  const session: SwiggySession = {
    mobile: data.mobile ?? '',
    customerId: data.customer_id ?? undefined,
    token: data.token,
    sid: json.sid,
    deviceId: json.deviceId,
    csrfToken: json.csrfToken,
    createdAt: Date.now(),
  }

  saveSwiggySession(session)
  return session
}

export async function fetchSwiggyOrders(session: SwiggySession) {
  return proxyFetch(SWIGGY_PROXY_URL('order-all', 'order_id='), {
    method: 'GET',
    headers: {
      'user-id': session.customerId ?? '0',
    },
  })
}
