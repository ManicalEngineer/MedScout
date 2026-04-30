import type { Metadata } from 'next'
import { Lexend } from 'next/font/google'
import { Analytics } from '@vercel/analytics/react'
import { PostHogProvider } from '@/components/PostHogProvider'
import './globals.css'

const lexend = Lexend({
  subsets: ['latin'],
  variable: '--font-lexend',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'ADHD Med Survival Suite — Stop the Pharmacy Scavenger Hunt',
  description:
    'Track your pharmacy calls, predict your run-out date, and see where others are finding stock. Built for the ADHD community.',
  openGraph: {
    title: 'ADHD Med Survival Suite',
    description: 'The Waze for ADHD meds. Join the waitlist.',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={lexend.variable}>
      <body>
        <PostHogProvider>
          {children}
        </PostHogProvider>
        <Analytics />
      </body>
    </html>
  )
}
