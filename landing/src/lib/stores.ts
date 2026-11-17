// Single source for store links and the smart link. These are the existing
// listing URLs already used on the site; do not change without checking the
// live listings.
export const APP_STORE_URL = 'https://apps.apple.com/app/id6794949603'
export const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.medscout.app'

// Smart link: /get sends iPhone to the App Store, Android to Google Play and
// everyone else to the download section (QR + badges).
export const SITE_URL = 'https://www.medscout.tech'
export const QR_TARGET_URL = `${SITE_URL}/get?src=qr`

export type Platform = 'ios' | 'android' | 'desktop'
export type Store = 'ios' | 'android'

/** Server-side guess from the User-Agent. iPadOS Safari reports itself as a Mac,
 *  so iPads land on "desktop" here; the client button handles them instead. */
export function detectPlatform(ua: string | null | undefined): Platform {
  if (!ua) return 'desktop'
  if (/android/i.test(ua)) return 'android'
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios'
  return 'desktop'
}

export function storeUrl(store: Store): string {
  return store === 'ios' ? APP_STORE_URL : PLAY_STORE_URL
}

/** href for a store badge: goes through /get so the click is counted server-side. */
export function storeHref(store: Store, src: string): string {
  return `/get?store=${store}&src=${encodeURIComponent(src)}`
}
