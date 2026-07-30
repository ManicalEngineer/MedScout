import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Delete Your Account — MedScout',
  description: 'How to delete your MedScout account and what happens to your data.',
}

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-10 mb-3 text-xl font-semibold text-[#F0F6FC] sm:text-2xl">{children}</h2>
  )
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="mb-4 leading-relaxed text-[#8B949E]">{children}</p>
}

function OL({ children }: { children: React.ReactNode }) {
  return <ol className="mb-4 ml-5 list-decimal space-y-1.5 text-[#8B949E]">{children}</ol>
}

function UL({ children }: { children: React.ReactNode }) {
  return <ul className="mb-4 ml-5 list-disc space-y-1.5 text-[#8B949E]">{children}</ul>
}

export default function DeleteAccountPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16 sm:py-24" style={{ scrollSnapType: 'none' }}>
      <Link
        href="/"
        className="mb-10 inline-flex items-center gap-1.5 text-sm text-[#8B949E] transition-colors hover:text-[#F97316]"
      >
        &larr; Back to MedScout
      </Link>

      <h1 className="text-3xl font-bold leading-tight text-[#F0F6FC] sm:text-4xl">
        Delete Your Account
      </h1>

      <H2>Option 1: Delete it in the app</H2>
      <P>The fastest way to delete your MedScout account:</P>
      <OL>
        <li>Open MedScout and sign in</li>
        <li>Go to the <span className="text-[#F0F6FC]">Me</span> tab</li>
        <li>Scroll to <span className="text-[#F0F6FC]">Danger Zone</span></li>
        <li>Tap <span className="text-[#F0F6FC]">Delete account</span> and confirm</li>
      </OL>
      <P>Deletion is immediate and cannot be undone.</P>

      <H2>Option 2: Request deletion without signing in</H2>
      <P>
        If you can&rsquo;t or don&rsquo;t want to sign back into the app, email{' '}
        <span className="text-[#F0F6FC]">privacy@getmedscout.com</span> from the address associated
        with your account and ask us to delete it. We may need to verify your identity before
        completing the request.
      </P>

      <H2>What gets deleted</H2>
      <UL>
        <li>Your email address and account credentials</li>
        <li>Saved pharmacies and your pharmacy vault</li>
        <li>Call logs and private notes</li>
        <li>Refill countdown settings</li>
        <li>Restock alert subscriptions</li>
        <li>Push-notification token</li>
      </UL>

      <H2>What doesn&rsquo;t get deleted</H2>
      <P>
        Medication profiles (medication name, strength, formulation, any child/dependent info)
        already live only on your device and are never sent to us in the first place &mdash;
        there&rsquo;s nothing server-side to delete. Uninstalling the app removes this data.
      </P>
      <P>
        Community stock reports you may have contributed are anonymous by design &mdash; they were
        never linked to your account or identity, so deleting your account doesn&rsquo;t change
        them; there is nothing in that data that identifies you to begin with.
      </P>
      <P>
        We may also retain limited information as required for legal, security, or
        fraud-prevention purposes, or in backups for a reasonable period, consistent with our{' '}
        <Link href="/privacy" className="text-[#F97316] underline underline-offset-2">
          Privacy Policy
        </Link>
        .
      </P>

      <div className="mt-16 border-t border-[#30363D] pt-8">
        <Link href="/" className="text-sm text-[#8B949E] transition-colors hover:text-[#F97316]">
          &larr; Back to MedScout
        </Link>
      </div>
    </main>
  )
}
