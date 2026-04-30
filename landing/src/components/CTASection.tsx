'use client'

import { useState } from 'react'
import posthog from 'posthog-js'

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

      posthog.capture('waitlist_signup')
      setStatus('success')
    } catch (err) {
      setStatus('error')
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong')
    }
  }

  return (
    <section
      id="waitlist"
      className="relative flex h-screen flex-col items-center justify-center px-6 text-center overflow-hidden"
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
            {/* Community badge */}
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-[#30363D]" style={{ maxWidth: 64 }} />
              <span className="text-xs font-medium uppercase tracking-widest text-[#8B949E]">
                Built by the community, for the community
              </span>
              <div className="h-px flex-1 bg-[#30363D]" style={{ maxWidth: 64 }} />
            </div>

            {/* Headline */}
            <div>
              <h2 className="mb-4 text-4xl font-bold leading-tight text-[#F0F6FC] sm:text-5xl">
                We don&apos;t rely on{' '}
                <span className="text-[#8B949E] line-through decoration-[#EF4444]">
                  broken pharmacy APIs.
                </span>
                <br />
                We rely on <span className="text-[#F97316]">each other.</span>
              </h2>
              <p className="text-lg leading-relaxed text-[#8B949E]">
                Share your fill status and unlock the full intelligence suite — free, forever, for contributors.
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

            {/* Email form */}
            <form onSubmit={handleSubmit} className="flex w-full flex-col gap-3 sm:flex-row">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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

        <p className="text-xs text-[#30363D]">ADHD Med Survival Suite · 2026</p>
      </div>
    </section>
  )
}
