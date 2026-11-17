'use client'

import { useRef } from 'react'
import posthog from 'posthog-js'
import { X } from 'lucide-react'
import { StoreBadges } from './StoreBadges'

/** "Get the App". On phones the link goes to /get, which redirects to the
 *  right store. On desktop it opens a panel with a QR code and both badges.
 *  Without JavaScript the link still works: /get sends desktops to #download. */
export function GetAppButton({ qrSvg }: { qrSvg: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    const ua = navigator.userAgent
    if (/android|iphone|ipod/i.test(ua)) return // let /get redirect
    // iPadOS Safari reports itself as a Mac; send it to the App Store directly.
    if (/ipad/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) {
      e.preventDefault()
      window.location.href = '/get?store=ios&src=hero'
      return
    }
    e.preventDefault()
    dialogRef.current?.showModal()
    posthog.capture('get_app_qr_opened', { source: 'hero' })
  }

  return (
    <>
      <a
        href="/get?src=hero"
        onClick={handleClick}
        className="rounded-lg bg-[#F97316] px-7 py-3.5 text-base font-semibold text-white shadow-lg transition-colors hover:bg-[#EA6C0A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F97316]"
        style={{ boxShadow: '0 0 24px rgba(249,115,22,0.25)' }}
      >
        Get the App &rarr;
      </a>

      <dialog
        ref={dialogRef}
        aria-labelledby="get-app-title"
        onClick={(e) => {
          if (e.target === dialogRef.current) dialogRef.current?.close()
        }}
        className="m-auto w-[min(92vw,420px)] rounded-2xl border border-[#30363D] bg-[#161B22] p-0 text-[#F0F6FC] backdrop:bg-black/70"
      >
        <div className="relative flex flex-col items-center gap-5 px-6 py-7 text-center">
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            aria-label="Close"
            className="absolute right-3 top-3 rounded-md p-1.5 text-[#8B949E] transition-colors hover:text-[#F0F6FC]"
          >
            <X size={18} aria-hidden />
          </button>
          <h2 id="get-app-title" className="text-xl font-bold">
            Get Med<span className="text-[#F97316]">Scout</span> on your phone
          </h2>
          <p className="text-sm text-[#8B949E]">Scan with your phone camera. It opens the right store.</p>
          <div
            className="h-48 w-48 overflow-hidden rounded-xl bg-white p-2"
            role="img"
            aria-label="QR code linking to the MedScout app"
            dangerouslySetInnerHTML={{ __html: qrSvg }}
          />
          <StoreBadges src="qr_panel" />
        </div>
      </dialog>
    </>
  )
}
