import { ChevronDown } from 'lucide-react'

export function HeroSection() {
  return (
    <section className="relative flex h-screen flex-col items-center justify-center px-6 text-center overflow-hidden">
      {/* Subtle radial glow behind headline */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 60% 40% at 50% 45%, rgba(249,115,22,0.08) 0%, transparent 70%)',
        }}
      />

      <div className="relative z-10 flex max-w-3xl flex-col items-center gap-6">
        {/* Badge */}
        <span className="animate-fade-up inline-flex items-center gap-2 rounded-full border border-[#30363D] bg-[#161B22] px-4 py-1.5 text-sm text-[#8B949E]">
          <span
            className="inline-block h-2 w-2 rounded-full bg-[#22C55E]"
            style={{ animation: 'pulse-dot 2s ease-in-out infinite' }}
          />
          Now accepting beta waitlist signups
        </span>

        {/* Headline */}
        <h1 className="animate-fade-up-delay-1 text-5xl font-bold leading-tight tracking-tight text-[#F0F6FC] sm:text-6xl lg:text-7xl">
          Stop the{' '}
          <span className="text-[#F97316]">Pharmacy&nbsp;Scavenger&nbsp;Hunt.</span>
        </h1>

        {/* Subheadline */}
        <p className="animate-fade-up-delay-2 max-w-xl text-xl leading-relaxed text-[#8B949E]">
          Calling 20 pharmacies every month isn&apos;t a medical plan&mdash;it&apos;s a second job.{' '}
          <span className="text-[#F0F6FC]">No calls. No drives. No panic.</span>
        </p>

        {/* Feature tags */}
        <div className="animate-fade-up-delay-3 flex flex-wrap justify-center gap-3 text-sm text-[#8B949E]">
          {['Track calls in one tap', 'Predict your run-out date', 'See where others find stock'].map(
            (tag) => (
              <span
                key={tag}
                className="flex items-center gap-1.5 rounded-md border border-[#30363D] bg-[#161B22] px-3 py-1"
              >
                <span className="text-[#F97316]">→</span>
                {tag}
              </span>
            )
          )}
        </div>

        {/* CTA */}
        <div className="animate-fade-up-delay-4 flex flex-col items-center gap-3">
          <a
            href="#waitlist"
            className="rounded-lg bg-[#F97316] px-8 py-4 text-base font-semibold text-white shadow-lg transition-colors hover:bg-[#EA6C0A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#F97316]"
            style={{ boxShadow: '0 0 24px rgba(249,115,22,0.25)' }}
          >
            Find My Medication &rarr;
          </a>
          <p className="text-sm text-[#8B949E]">Free for early contributors. No spam, just survival.</p>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-[#30363D]">
        <span className="text-xs tracking-widest uppercase text-[#8B949E] opacity-60">Explore</span>
        <ChevronDown size={20} className="animate-bounce text-[#8B949E] opacity-60" />
      </div>
    </section>
  )
}
