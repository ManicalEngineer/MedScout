import { MapMockup } from './MapMockup'

const features = [
  {
    icon: (
      <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
      </svg>
    ),
    title: 'Smart Call Tracker',
    description:
      'Log every CVS and Walgreens you call. AI extracts the shipment day and stock status from your voice — no typing required during a stressful hunt.',
  },
  {
    icon: (
      <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
    ),
    title: 'Refill Countdown',
    description:
      'A visual timer that tells you exactly when to start the hunt — not when it\'s already too late. Prompts you 5–7 days before your last pill.',
  },
  {
    icon: (
      <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 0 0-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0Z" />
      </svg>
    ),
    title: 'Community Availability Map',
    description:
      'Real-time, human-verified reports. See which strengths and manufacturers are landing in your zip code right now — before you start dialing.',
  },
]

export function FeaturesSection() {
  return (
    <section className="flex flex-col items-center justify-center px-6 py-16 sm:py-24" style={{ background: '#161B22' }}>
      <div className="w-full max-w-5xl">
        {/* Heading */}
        <div className="mb-10 text-center">
          <p className="mb-2 text-sm font-medium uppercase tracking-widest text-[#F97316]">How it works</p>
          <h2 className="text-3xl font-bold text-[#F0F6FC] sm:text-4xl">
            Everything you need to survive the shortage.
          </h2>
        </div>

        {/* Layout: feature list left, map right */}
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-12">
          {/* Feature cards */}
          <div className="flex flex-col gap-4 lg:w-2/5">
            {features.map((f, i) => (
              <div
                key={i}
                className="group flex gap-4 rounded-xl border border-[#30363D] bg-[#0D1117] p-5 transition-colors hover:border-[#F97316]/40"
              >
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#161B22] text-[#F97316] border border-[#30363D] group-hover:border-[#F97316]/40">
                  {f.icon}
                </div>
                <div>
                  <h3 className="mb-1 font-semibold text-[#F0F6FC]">{f.title}</h3>
                  <p className="text-sm leading-relaxed text-[#8B949E]">{f.description}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Map mockup */}
          <div className="flex flex-1 flex-col items-center justify-start lg:items-start">
            <p className="mb-3 text-xs font-medium uppercase tracking-widest text-[#8B949E]">
              Community Availability Map — Preview
            </p>
            <MapMockup />
            <p className="mt-3 text-xs text-[#8B949E]">
              * Simulated data. Real map powered by contributor reports.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
