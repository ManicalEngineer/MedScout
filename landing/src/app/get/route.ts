import { after, type NextRequest } from 'next/server'
import { detectPlatform, storeUrl, type Platform, type Store } from '@/lib/stores'

// The response depends on the User-Agent, so it must never be cached by
// Cloudflare or the browser: a cached iPhone redirect would send Android users
// to the App Store.
const NO_CACHE_HEADERS = {
  'Cache-Control': 'private, no-store, no-cache, max-age=0, must-revalidate',
  'CDN-Cache-Control': 'no-store',
  'Cloudflare-CDN-Cache-Control': 'no-store',
  Vary: 'User-Agent',
  'X-Robots-Tag': 'noindex',
}

const BOT_UA = /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|whatsapp|telegram|discord|curl|wget/i

const SOURCE_RE = /^[a-z0-9_-]{1,32}$/i

function parseStore(value: string | null): Store | null {
  return value === 'ios' || value === 'android' ? value : null
}

async function capture(props: { platform: Platform; store: Store | null; source: string; ua: string }) {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
  if (!key) return
  const host = process.env.POSTHOG_SERVER_HOST ?? 'https://us.i.posthog.com'
  try {
    await fetch(`${host}/i/v0/e/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: key,
        event: 'get_app_redirect',
        // Anonymous: no cookie or account to tie this to, and no person profile.
        distinct_id: crypto.randomUUID(),
        properties: {
          platform: props.platform,
          store: props.store ?? 'none',
          source: props.source,
          $process_person_profile: false,
          $raw_user_agent: props.ua,
          $lib: 'medscout-landing-get',
        },
      }),
      signal: AbortSignal.timeout(3000),
    })
  } catch {
    // Analytics must never break the redirect.
  }
}

function resolve(request: NextRequest) {
  const ua = request.headers.get('user-agent') ?? ''
  const params = request.nextUrl.searchParams
  const platform = detectPlatform(ua)
  const rawSource = params.get('src') ?? 'direct'
  const source = SOURCE_RE.test(rawSource) ? rawSource : 'other'
  // A badge click names its store; otherwise follow the device.
  const store: Store | null = parseStore(params.get('store')) ?? (platform === 'desktop' ? null : platform)
  const location = store ? storeUrl(store) : '/#download' // relative: never leaks an internal host behind the proxy
  return { ua, platform, source, store, location }
}

function redirect(location: string) {
  return new Response(null, { status: 302, headers: { ...NO_CACHE_HEADERS, Location: location } })
}

export function GET(request: NextRequest) {
  const { ua, platform, source, store, location } = resolve(request)
  if (!BOT_UA.test(ua)) after(() => capture({ platform, store, source, ua }))
  return redirect(location)
}

// HEAD gets the same uncached redirect, without counting it.
export function HEAD(request: NextRequest) {
  return redirect(resolve(request).location)
}
