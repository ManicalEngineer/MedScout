import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Terms of Service — MedScout',
  description: 'The terms that govern your use of MedScout.',
}

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-10 mb-3 text-xl font-semibold text-[#F0F6FC] sm:text-2xl">{children}</h2>
  )
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="mb-4 leading-relaxed text-[#8B949E]">{children}</p>
}

function UL({ children }: { children: React.ReactNode }) {
  return <ul className="mb-4 ml-5 list-disc space-y-1.5 text-[#8B949E]">{children}</ul>
}

export default function TermsOfServicePage() {
  return (
    <main
      className="mx-auto max-w-2xl px-6 py-16 sm:py-24"
      style={{ scrollSnapType: 'none' }}
    >
      <Link
        href="/"
        className="mb-10 inline-flex items-center gap-1.5 text-sm text-[#8B949E] transition-colors hover:text-[#F97316]"
      >
        &larr; Back to MedScout
      </Link>

      <h1 className="text-3xl font-bold leading-tight text-[#F0F6FC] sm:text-4xl">
        Terms of Service
      </h1>
      <p className="mt-3 text-sm text-[#8B949E]">
        Effective date: October 21, 2026 &middot; Last updated: October 21, 2026
      </p>

      <P>
        These Terms of Service (&ldquo;Terms&rdquo;) govern your use of the MedScout mobile app,
        website, and related services (together, the &ldquo;Service&rdquo;), provided by MedScout
        (&ldquo;MedScout,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;). By
        creating an account or using the Service, you agree to these Terms and to our{' '}
        <Link href="/privacy" className="text-[#F97316] hover:underline">
          Privacy Policy
        </Link>
        . If you do not agree, do not use the Service.
      </P>

      <H2>1. What MedScout Does</H2>
      <P>
        MedScout helps people find medication availability, organize pharmacy calls, track refill
        information, and optionally contribute medication stock reports to a community of other
        users.
      </P>

      <H2>2. Not Medical Advice</H2>
      <P>
        MedScout provides medication availability and organizational tools only. It does not
        provide medical advice, diagnosis, treatment recommendations, or emergency services, and
        nothing in the Service creates a pharmacist&ndash;patient or doctor&ndash;patient
        relationship.
      </P>
      <P>
        Availability information, including community reports, shortage data, and automatically
        detected call results, may be incomplete, delayed, or wrong. Always confirm availability
        and any decision about your medication with a pharmacist or qualified healthcare
        professional. Never delay or stop treatment because of something you saw or did not see in
        MedScout. If you are experiencing a medical emergency, call your local emergency number.
      </P>

      <H2>3. Eligibility and Accounts</H2>
      <P>
        You must be at least 13 years old to use MedScout, and old enough in your jurisdiction to
        form a binding contract, or have a parent or guardian agree on your behalf. You are
        responsible for the accuracy of the information you provide, for keeping your credentials
        secure, and for all activity under your account. Tell us promptly at{' '}
        <span className="text-[#F0F6FC]">support@getmedscout.com</span> if you believe your
        account has been compromised.
      </P>
      <P>
        If you track medication for a child or dependent, you confirm that you are their parent,
        guardian, or caregiver and are entitled to do so.
      </P>

      <H2>4. Community Reports and Good-Faith Contributions</H2>
      <P>
        MedScout&rsquo;s community features only work if reports are honest. If you contribute a
        stock report, you agree that:
      </P>
      <UL>
        <li>The report reflects what you actually learned from a real contact with that pharmacy</li>
        <li>You will not submit false, fabricated, or misleading reports</li>
        <li>
          You will not submit reports to manipulate availability data, harm or promote a
          particular pharmacy, game any access or reward feature, or otherwise act in bad faith
        </li>
        <li>You will not use scripts, bots, or other automated means to submit reports</li>
        <li>You will not submit another person&rsquo;s personal information in a report</li>
      </UL>
      <P>
        <span className="text-[#F0F6FC]">
          We reserve the right to restrict, suspend, or terminate access for any user we
          reasonably believe is contributing in bad faith, including by submitting fake,
          fabricated, or abusive reports.
        </span>{' '}
        We may do so at our discretion, with or without prior notice, and we may remove or
        disregard any report we believe is inaccurate or abusive. Restrictions may include
        limiting your ability to contribute, removing access to features that depend on
        contributing (such as community availability data), or closing your account.
      </P>
      <P>
        Community reports are never shown with your name or profile, and we do not store a link
        between a report and your account. We may use technical and behavioral signals, such as
        submission rates, patterns, and device or account activity, to detect abuse and apply
        restrictions to the account or device responsible.
      </P>
      <P>
        By contributing a report, you give MedScout a perpetual, worldwide, royalty-free,
        non-exclusive license to use, store, aggregate, display, analyze, and distribute it,
        including on a de-identified basis, as described in the Privacy Policy. You keep any
        rights you have in your report, and you confirm you have the right to grant this license.
      </P>

      <H2>5. Calling Pharmacies and Recording</H2>
      <P>
        MedScout can help you place calls to pharmacies and, if you choose, record and transcribe
        them on your device. Laws on recording phone calls vary by location, and some require
        consent from everyone on the call. You are solely responsible for complying with the
        recording and consent laws that apply to you and the people you call, and for using
        recording features only where you are permitted to. Transcripts are processed on your
        device and are not sent to our servers.
      </P>

      <H2>6. Acceptable Use</H2>
      <P>You agree not to:</P>
      <UL>
        <li>Use the Service for anything unlawful or to harass, defraud, or harm others</li>
        <li>Interfere with, overload, or attempt to disrupt the Service or its security</li>
        <li>
          Scrape, copy, resell, or build a competing dataset from the Service or its community
          data without our written permission
        </li>
        <li>Reverse engineer the app or access another user&rsquo;s account or data</li>
        <li>Use the Service to obtain controlled substances unlawfully or to divert medication</li>
        <li>Misrepresent your identity or affiliation, including as a pharmacy or healthcare provider</li>
      </UL>

      <H2>7. Subscriptions and Payments</H2>
      <P>
        Some features may in future be offered as paid subscriptions. If so, pricing, billing
        period, and renewal terms will be shown before you subscribe. Purchases made through the
        Apple App Store or Google Play are processed by them and are subject to their payment and
        refund policies. You can cancel at any time through your app store account settings.
      </P>

      <H2>8. Third-Party Services and Data</H2>
      <P>
        The Service relies on third-party data and services, such as Google Maps and Places,
        public drug-shortage data, and pharmacy information. We do not control these sources and
        are not responsible for their accuracy, availability, or terms. Pharmacy names, phone
        numbers, and locations belong to their respective owners, and MedScout has no affiliation
        with, or endorsement from, any pharmacy unless stated.
      </P>

      <H2>9. Our Intellectual Property</H2>
      <P>
        The Service, including its software, design, text, and branding, is owned by MedScout and
        its licensors and is protected by intellectual property laws. We grant you a limited,
        personal, non-exclusive, non-transferable, revocable license to use the app for its
        intended purpose. All other rights are reserved.
      </P>

      <H2>10. Suspension and Termination</H2>
      <P>
        You may stop using MedScout and delete your account at any time (see{' '}
        <Link href="/delete-account" className="text-[#F97316] hover:underline">
          Delete your account
        </Link>
        ). We may suspend or terminate your access at any time if you violate these Terms,
        including Section 4, if required by law, or if continuing to provide the Service to you
        creates risk for us or other users. Sections that by their nature should survive
        termination will survive, including Sections 2, 4 (license), 9, and 11 through 14.
      </P>

      <H2>11. Disclaimers</H2>
      <P>
        The Service is provided &ldquo;as is&rdquo; and &ldquo;as available.&rdquo; To the fullest
        extent permitted by law, we disclaim all warranties, express or implied, including
        warranties of merchantability, fitness for a particular purpose, accuracy, and
        non-infringement. We do not guarantee that medication will be available at any pharmacy,
        that the Service will be uninterrupted or error-free, or that any information in it is
        correct.
      </P>

      <H2>12. Limitation of Liability</H2>
      <P>
        To the fullest extent permitted by law, MedScout and its owners, officers, employees, and
        contractors will not be liable for any indirect, incidental, special, consequential, or
        punitive damages, or for any loss of profits, data, or goodwill, arising from or related to
        your use of the Service, including any decision you make based on information in it. Our
        total liability for any claim relating to the Service will not exceed the greater of the
        amount you paid us in the 12 months before the claim or US$100. Some jurisdictions do not
        allow certain limitations, so some of these may not apply to you.
      </P>

      <H2>13. Indemnification</H2>
      <P>
        You agree to indemnify and hold MedScout harmless from claims, damages, and expenses
        (including reasonable legal fees) arising from your misuse of the Service, your violation
        of these Terms, or the content you submit.
      </P>

      <H2>14. Governing Law and Disputes</H2>
      <P>
        These Terms are governed by the laws of the State of New York, without regard to its
        conflict-of-law rules. Any dispute that cannot be resolved informally will be brought in
        the state or federal courts located in or serving Saratoga County, New York, and you
        consent to their jurisdiction, except where the law of your place of residence requires
        otherwise.
      </P>

      <H2>15. Changes to These Terms</H2>
      <P>
        We may update these Terms from time to time. When we make material changes, we will update
        the effective date and provide notice through the Service or another reasonable method.
        Continuing to use MedScout after changes take effect means you accept the updated Terms.
      </P>

      <H2>16. Contact Us</H2>
      <p className="mb-4 leading-relaxed text-[#F0F6FC]">
        Email: support@getmedscout.com
        <br />
        Company: MedScout
        <br />
        Address: 4 New Hampshire Ct, Rexford, NY 12148
        <br />
        Website: getmedscout.com
      </p>

      <div className="mt-16 border-t border-[#30363D] pt-8">
        <Link href="/" className="text-sm text-[#8B949E] transition-colors hover:text-[#F97316]">
          &larr; Back to MedScout
        </Link>
      </div>
    </main>
  )
}
