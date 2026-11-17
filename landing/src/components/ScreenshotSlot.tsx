import fs from 'node:fs'
import path from 'node:path'
import Image from 'next/image'

/**
 * SCREENSHOT SLOT: real app screenshots only.
 *
 * Drop a PNG at public/screenshots/<file> and rebuild; it appears in the card.
 * Until the file exists this renders nothing, so the live page never shows an
 * empty frame. Do not put mockups or generated images here.
 *
 *   public/screenshots/smart-call-tracker.png
 *   public/screenshots/refill-countdown.png
 *
 * The check runs at build time (the page is static), so a new file needs a
 * rebuild/deploy to show up.
 */
export function ScreenshotSlot({ file, alt }: { file: string; alt: string }) {
  const onDisk = path.join(process.cwd(), 'public', 'screenshots', file)
  if (!fs.existsSync(onDisk)) return null
  return (
    <div data-screenshot-slot={file} className="mt-4 overflow-hidden rounded-2xl border border-[#30363D] bg-[#161B22]">
      <Image
        src={`/screenshots/${file}`}
        alt={alt}
        width={1170}
        height={2532}
        sizes="(min-width: 1024px) 320px, 80vw"
        className="mx-auto h-auto w-full max-w-[280px]"
      />
    </div>
  )
}
