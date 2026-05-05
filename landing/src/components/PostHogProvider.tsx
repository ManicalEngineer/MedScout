'use client'

import posthog from 'posthog-js'
import { PostHogProvider as PHProvider, usePostHog } from 'posthog-js/react'
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

function PostHogPageView() {
  const pathname = usePathname()
  const client = usePostHog()

  useEffect(() => {
    if (!client) return
    const url = window.location.href
    client.capture('$pageview', { $current_url: url })
    return () => {
      client.capture('$pageleave', { $current_url: url })
    }
  }, [pathname, client])

  return null
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
    if (!key) return
    posthog.init(key, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://data.getmedscout.com',
      ui_host: 'https://us.posthog.com',
      capture_pageview: false,
      capture_pageleave: false,
      persistence: 'localStorage',
    })
  }, [])

  return (
    <PHProvider client={posthog}>
      <PostHogPageView />
      {children}
    </PHProvider>
  )
}
