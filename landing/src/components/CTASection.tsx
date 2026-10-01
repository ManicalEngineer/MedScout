'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import posthog from 'posthog-js'
import { Apple, ArrowUpRight, Check, Smartphone, X } from 'lucide-react'

const perks = [
  { icon: '🗺️', label: 'Regional heatmaps' },
  { icon: '🔔', label: 'Shortage alerts' },
  { icon: '📊', label: 'Advanced predictions' },
]

function ThankYouPanel() {
  const [feedback, setFeedback] = useState('')
  const [feedbackStatus, setFeedbackStatus] = useState<'idle' | 'submitted' | 'skipped'>('idle')

  function handleFeedbackSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!feedback.trim()) return
    posthog.capture('waitlist_feedback', { response: feedback.trim() })
    setFeedbackStatus('submitted')
  }

  function handleSkip() {
    posthog.capture('waitlist_feedback_skipped')
    setFeedbackStatus('skipped')
  }

  if (feedbackStatus === 'submitted' || feedbackStatus === 'skipped') {
    return (
      <div className="flex w-full flex-col items-center gap-3 rounded-xl border border-[#22C55E]/20 bg-[#22C55E]/5 px-8 py-8">
        <span className="text-4xl">🙏</span>
        <p className="font-semibold text-[#F0F6FC]">
          {feedbackStatus === 'submitted' ? 'Your insight helps us build the right thing.' : 'No worries — we\'ll be in touch.'}
        </p>
        <p className="text-sm text-[#8B949E]">
          We&apos;ll reach out with beta access as soon as it&apos;s ready.
        </p>
      </div>
    )
  }

  return (
    <div className="flex w-full flex-col gap-4 rounded-xl border border-[#30363D] bg-[#161B22] px-6 py-6">
      {/* Confirmation line */}
      <div className="flex items-center gap-3">
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#22C55E]/15 text-sm text-[#22C55E]"
        >
          ✓
        </span>
        <p className="font-semibold text-[#22C55E]">You&apos;re on the list.</p>
      </div>

      <div className="h-px bg-[#30363D]" />

      {/* Follow-up question */}
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-[#F0F6FC]">One quick question while we build the beta:</p>
        <p className="text-base font-semibold leading-snug text-[#F0F6FC]">
          What&apos;s the single most frustrating part of your monthly pharmacy routine?
        </p>
        <p className="text-xs text-[#8B949E]">
          Your answer directly shapes what we prioritize first. Takes 30 seconds.
        </p>
      </div>

      <form onSubmit={handleFeedbackSubmit} className="flex flex-col gap-3">
        <textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="e.g. &quot;I have to call 15+ pharmacies and they always say check back later with no timeline.&quot;"
          rows={3}
          className="w-full resize-none rounded-lg border border-[#30363D] bg-[#0D1117] px-4 py-3 text-sm text-[#F0F6FC] placeholder-[#8B949E] outline-none transition-colors focus:border-[#F97316] focus:ring-1 focus:ring-[#F97316]"
        />
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={!feedback.trim()}
            className="flex-1 rounded-lg bg-[#F97316] py-3 text-sm font-semibold text-white transition-colors hover:bg-[#EA6C0A] disabled:opacity-40"
          >
            Share My Experience →
          </button>
          <button
            type="button"
            onClick={handleSkip}
            className="rounded-lg border border-[#30363D] bg-[#0D1117] px-4 py-3 text-sm text-[#8B949E] transition-colors hover:text-[#F0F6FC]"
          >
            Skip
          </button>
        </div>
      </form>
    </div>
  )
}

export function CTASection() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [androidEmail, setAndroidEmail] = useState('')
  const [androidStatus, setAndroidStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [androidErrorMsg, setAndroidErrorMsg] = useState('')
  const [isAndroidFormOpen, setIsAndroidFormOpen] = useState(false)
  const sectionRef = useRef<HTMLElement>(null)
  const hasFiredViewRef = useRef(false)
  const hasFiredFocusRef = useRef(false)

  useEffect(() => {
    const el = sectionRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasFiredViewRef.current) {
          posthog.capture('cta_viewed')
          hasFiredViewRef.current = true
          observer.disconnect()
        }
      },
      { threshold: 0.5 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  function handleEmailFocus() {
    if (hasFiredFocusRef.current) return
    posthog.capture('cta_email_focused')
    hasFiredFocusRef.current = true
  }

  function handlePlatformClick(platform: 'ios' | 'android') {
    posthog.capture('beta_cta_clicked', { platform })

    if (platform === 'ios') {
      const testFlightUrl = process.env.NEXT_PUBLIC_TESTFLIGHT_URL
      if (testFlightUrl) {
        window.open(testFlightUrl, '_blank', 'noopener,noreferrer')
      } else {
        setErrorMsg('TestFlight is not configured yet.')
        setStatus('error')
      }
      return
    }

    setIsAndroidFormOpen(true)
    setAndroidStatus('idle')
    setAndroidErrorMsg('')
  }

  async function handleAndroidSubmit(e: React.FormEvent) {
    e.preventDefault()
    const normalizedEmail = androidEmail.trim()
    if (!normalizedEmail) return

    setAndroidStatus('loading')
    setAndroidErrorMsg('')

    try {
      const res = await fetch('/api/beta/android', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Something went wrong')

      posthog.capture('android_beta_requested', { email: normalizedEmail })
      setAndroidStatus('success')
    } catch (err) {
      setAndroidStatus('error')
      setAndroidErrorMsg(err instanceof Error ? err.message : 'Something went wrong')
    }
  }

  function closeAndroidForm() {
    if (androidStatus === 'loading') return
    setIsAndroidFormOpen(false)
    setAndroidStatus('idle')
    setAndroidErrorMsg('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email) return

    setStatus('loading')
    setErrorMsg('')

    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Something went wrong')
      }

      posthog.identify(email)
      posthog.capture('waitlist_signup', { email })
      setStatus('success')
    } catch (err) {
      setStatus('error')
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong')
    }
  }

  return (
    <section
      ref={sectionRef}
      id="waitlist"
      className="relative flex min-h-screen flex-col items-center justify-center px-6 py-20 text-center overflow-hidden"
    >
      {/* Glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 50% 35% at 50% 60%, rgba(249,115,22,0.07) 0%, transparent 70%)',
        }}
      />

      <div className="relative z-10 flex w-full max-w-xl flex-col items-center gap-8">
        {status === 'success' ? (
          <ThankYouPanel />
        ) : (
          <>
            {/* Badge */}
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-[#30363D]" style={{ maxWidth: 64 }} />
              <span className="text-xs font-medium uppercase tracking-widest text-[#8B949E]">
                Stop the monthly guessing game
              </span>
              <div className="h-px flex-1 bg-[#30363D]" style={{ maxWidth: 64 }} />
            </div>

            {/* Headline */}
            <div>
              <h2 className="mb-4 text-3xl font-bold leading-tight text-[#F0F6FC] sm:text-4xl lg:text-5xl">
                Know where it is{' '}
                <span className="text-[#F97316]">before you run out.</span>
              </h2>
              <p className="text-lg leading-relaxed text-[#8B949E]">
                Every contributor shares their fill status — you get real-time stock intelligence in return. Free, forever, for contributors.
              </p>
            </div>

            {/* Perks */}
            <div className="flex flex-wrap justify-center gap-3">
              {perks.map((p) => (
                <div
                  key={p.label}
                  className="flex items-center gap-2 rounded-full border border-[#30363D] bg-[#161B22] px-4 py-2 text-sm text-[#F0F6FC]"
                >
                  <span>{p.icon}</span>
                  <span>{p.label}</span>
                </div>
              ))}
            </div>

            {/* Platform beta access */}
            <div className="flex w-full flex-col gap-3 text-left">
              <div>
                <p className="text-sm font-semibold text-[#F0F6FC]">Get the app</p>
                <p className="mt-1 text-sm text-[#8B949E]">Choose your platform to start testing MedScout.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => handlePlatformClick('ios')}
                  className="group flex items-center justify-between rounded-xl border border-[#F97316]/40 bg-[#F97316]/10 px-4 py-4 text-left transition-colors hover:border-[#F97316] hover:bg-[#F97316]/20"
                >
                  <span className="flex items-center gap-3">
                    <Apple className="h-5 w-5 text-[#F97316]" aria-hidden />
                    <span>
                      <span className="block font-semibold text-[#F0F6FC]">Download for iOS</span>
                      <span className="block text-xs text-[#8B949E]">TestFlight</span>
                    </span>
                  </span>
                  <ArrowUpRight className="h-4 w-4 text-[#8B949E] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => handlePlatformClick('android')}
                  className="group flex items-center justify-between rounded-xl border border-[#30363D] bg-[#161B22] px-4 py-4 text-left transition-colors hover:border-[#F97316] hover:bg-[#1C2128]"
                >
                  <span className="flex items-center gap-3">
                    <Smartphone className="h-5 w-5 text-[#F97316]" aria-hidden />
                    <span>
                      <span className="block font-semibold text-[#F0F6FC]">Join Android Beta</span>
                      <span className="block text-xs text-[#8B949E]">Google Play closed testing</span>
                    </span>
                  </span>
                  <ArrowUpRight className="h-4 w-4 text-[#8B949E] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
                </button>
              </div>
            </div>

            {isAndroidFormOpen && (
              <div className="w-full rounded-xl border border-[#30363D] bg-[#161B22] p-5 text-left">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-semibold text-[#F0F6FC]">Join the Android beta</h3>
                    <p className="mt-1 text-sm leading-relaxed text-[#8B949E]">
                      Enter the Google Account email you use on Google Play. We&apos;ll send an invite link once access is ready.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={closeAndroidForm}
                    aria-label="Close Android beta form"
                    className="rounded-md p-1 text-[#8B949E] transition-colors hover:bg-[#30363D] hover:text-[#F0F6FC]"
                  >
                    <X className="h-5 w-5" aria-hidden />
                  </button>
                </div>

                {androidStatus === 'success' ? (
                  <div className="mt-5 flex items-start gap-3 rounded-lg border border-[#22C55E]/20 bg-[#22C55E]/5 p-4">
                    <Check className="mt-0.5 h-5 w-5 shrink-0 text-[#22C55E]" aria-hidden />
                    <p className="text-sm leading-relaxed text-[#F0F6FC]">
                      Success! We&apos;ve sent an invite link to your email. Check your inbox to accept the Google Play testing invite.
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleAndroidSubmit} className="mt-5 flex flex-col gap-3 sm:flex-row">
                    <label htmlFor="android-beta-email" className="sr-only">Google Account email</label>
                    <input
                      id="android-beta-email"
                      type="email"
                      required
                      value={androidEmail}
                      onChange={(e) => setAndroidEmail(e.target.value)}
                      placeholder="you@gmail.com"
                      className="min-w-0 flex-1 rounded-lg border border-[#30363D] bg-[#0D1117] px-4 py-3 text-sm text-[#F0F6FC] placeholder-[#8B949E] outline-none transition-colors focus:border-[#F97316] focus:ring-1 focus:ring-[#F97316]"
                    />
                    <button
                      type="submit"
                      disabled={androidStatus === 'loading'}
                      className="rounded-lg bg-[#F97316] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#EA6C0A] disabled:opacity-60 whitespace-nowrap"
                    >
                      {androidStatus === 'loading' ? 'Requesting…' : 'Request access'}
                    </button>
                  </form>
                )}
                {androidStatus === 'error' && <p className="mt-3 text-sm text-[#EF4444]">{androidErrorMsg}</p>}
              </div>
            )}

            {/* Email form */}
            <form onSubmit={handleSubmit} className="flex w-full flex-col gap-3 sm:flex-row">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={handleEmailFocus}
                placeholder="you@example.com"
                className="flex-1 rounded-lg border border-[#30363D] bg-[#161B22] px-4 py-3.5 text-[#F0F6FC] placeholder-[#8B949E] outline-none transition-colors focus:border-[#F97316] focus:ring-1 focus:ring-[#F97316]"
              />
              <button
                type="submit"
                disabled={status === 'loading'}
                className="rounded-lg bg-[#F97316] px-6 py-3.5 font-semibold text-white transition-colors hover:bg-[#EA6C0A] disabled:opacity-60 whitespace-nowrap"
                style={{ boxShadow: '0 0 20px rgba(249,115,22,0.2)' }}
              >
                {status === 'loading' ? 'Joining…' : 'Get Early Access'}
              </button>
            </form>

            {status === 'error' && (
              <p className="text-sm text-[#EF4444]">{errorMsg}</p>
            )}

            <p className="text-xs text-[#8B949E]">
              Free for early contributors. No spam. Unsubscribe anytime.
            </p>
          </>
        )}

        <div className="flex items-center gap-3 text-xs text-[#30363D]">
          <span>ADHD Med Survival Suite · 2026</span>
          <span aria-hidden>·</span>
          <Link href="/privacy" className="transition-colors hover:text-[#8B949E]">
            Privacy Policy
          </Link>
        </div>
      </div>
    </section>
  )
}
