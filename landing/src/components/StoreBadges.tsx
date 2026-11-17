import Image from 'next/image'
import { storeHref, type Store } from '@/lib/stores'

// Official badge artwork, unmodified:
//   public/badges/app-store.svg   (Apple, 119.66 x 40)
//   public/badges/google-play.png (Google, 646 x 250 incl. Google's built-in
//                                  clear space; the badge itself is 564 x 168
//                                  at offset 41,41)
// Both are shown at the same visible height (--bh). The Google PNG is scaled
// so its badge, not its padding, matches that height, and the padding is
// clipped by the link box instead of edited out of the file.

const LABEL: Record<Store, string> = {
  ios: 'Download MedScout on the App Store',
  android: 'Get MedScout on Google Play',
}

// Google PNG geometry, as multiples of the visible badge height.
const G_FULL_W = 646 / 168
const G_FULL_H = 250 / 168
const G_OFFSET = 41 / 168
const G_VISIBLE_W = 564 / 168
const APPLE_W = 119.66407 / 40

interface BadgeProps {
  store: Store
  /** Where on the page the badge is; sent to analytics as `source`. */
  src: string
  size?: 'lg' | 'md'
}

export function StoreBadge({ store, src, size = 'md' }: BadgeProps) {
  // lg: 48px on phones (both fit side by side at 375px), 64px from sm up.
  const height = size === 'lg' ? '[--bh:48px] sm:[--bh:64px]' : '[--bh:48px]'
  const common = `${height} relative inline-block h-(--bh) shrink-0 overflow-hidden rounded-[calc(var(--bh)*0.12)] transition-opacity hover:opacity-85 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F97316]`

  if (store === 'ios') {
    return (
      <a href={storeHref('ios', src)} className={common} style={{ width: `calc(var(--bh) * ${APPLE_W})` }}>
        <Image src="/badges/app-store.svg" alt={LABEL.ios} width={120} height={40} className="h-full w-full" />
      </a>
    )
  }

  return (
    <a href={storeHref('android', src)} className={common} style={{ width: `calc(var(--bh) * ${G_VISIBLE_W})` }}>
      <Image
        src="/badges/google-play.png"
        alt={LABEL.android}
        width={646}
        height={250}
        unoptimized
        className="absolute max-w-none"
        style={{
          width: `calc(var(--bh) * ${G_FULL_W})`,
          height: `calc(var(--bh) * ${G_FULL_H})`,
          left: `calc(var(--bh) * -${G_OFFSET})`,
          top: `calc(var(--bh) * -${G_OFFSET})`,
        }}
      />
    </a>
  )
}

export function StoreBadges({ src, size = 'md' }: { src: string; size?: 'lg' | 'md' }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3">
      <StoreBadge store="ios" src={src} size={size} />
      <StoreBadge store="android" src={src} size={size} />
    </div>
  )
}
