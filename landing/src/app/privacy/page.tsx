import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Privacy Policy — MedScout',
  description: 'How MedScout collects, uses, and protects your information.',
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

export default function PrivacyPolicyPage() {
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
        Privacy Policy
      </h1>
      <p className="mt-3 text-sm text-[#8B949E]">
        Effective date: July 28, 2026 &middot; Last updated: July 28, 2026
      </p>

      <P>
        MedScout (&ldquo;MedScout,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;)
        helps people find medication availability, organize pharmacy calls, track refill
        information, and optionally contribute medication stock reports to the MedScout
        community.
      </P>
      <P>
        This Privacy Policy explains what information we collect, how we use it, how we protect
        it, and what information we may make available commercially.
      </P>

      <H2>1. Information We Collect</H2>
      <p className="mb-2 font-medium text-[#F0F6FC]">Account information</p>
      <P>When you create or use a MedScout account, we may collect:</P>
      <UL>
        <li>Email address</li>
        <li>Password credentials, stored in protected hashed form</li>
        <li>Sign-in information from Apple or Google when you use social login</li>
        <li>Push-notification token, if you enable notifications</li>
        <li>Account and subscription information</li>
      </UL>

      <p className="mb-2 font-medium text-[#F0F6FC]">Medication and health-related information</p>
      <P>
        You may track more than one medication (for example, a primary and a backup). Each
        medication profile &mdash; name, strength, formulation, and whether it relates to a child
        or dependent (including a child&rsquo;s name, if provided) &mdash; is stored{' '}
        <span className="text-[#F0F6FC]">only on your device</span>. MedScout&rsquo;s servers do
        not receive, store, or retain these profiles.
      </P>
      <P>
        Two narrower pieces of information do reach our servers, tied to your account, only to
        power features you&rsquo;ve turned on:
      </P>
      <UL>
        <li>
          <span className="text-[#F0F6FC]">
            Medication name and strength, per medication, only if you explicitly enable restock
            alerts for that specific medication.
          </span>{' '}
          Alerts are off by default for every medication you track &mdash; nothing is linked to
          your account automatically. Before turning one on, the app shows you that doing so links
          your account to that medication on our server so we can notify you; you can turn it off
          at any time, independently for each medication. Setting a refill reminder similarly ties
          that medication&rsquo;s name to your account, solely to send you the reminder.
        </li>
        <li>
          Pharmacy call results, status, and any notes you add about a call &mdash; kept private
          and never shared, including with the MedScout community, unless you explicitly choose to
          contribute a report
        </li>
      </UL>
      <P>
        Separately, your device may tell us &mdash; with no account or identity attached &mdash;
        that a given medication and strength is being tracked by someone, so we know to keep
        monitoring national shortage status for it. This signal cannot be traced back to you or
        any account.
      </P>
      <P>This information may be sensitive. We use it only to provide the features described above.</P>

      <p className="mb-2 font-medium text-[#F0F6FC]">Pharmacy and location information</p>
      <P>You may provide:</P>
      <UL>
        <li>Pharmacy name</li>
        <li>Pharmacy telephone number</li>
        <li>Pharmacy address</li>
        <li>ZIP code</li>
        <li>Geographic coordinates</li>
        <li>Private pharmacy entries stored in your personal vault</li>
      </UL>
      <P>Some pharmacy information may be stored privately and is not included in community reports.</P>

      <p className="mb-2 font-medium text-[#F0F6FC]">Community stock reports</p>
      <P>If you choose to contribute information to the MedScout community, we may collect:</P>
      <UL>
        <li>Medication name and strength</li>
        <li>Stock status, such as in stock, out of stock, or check back</li>
        <li>Pharmacy name or location</li>
        <li>ZIP code or approximate geographic location</li>
        <li>Expected restock date, if provided</li>
        <li>Date and time of the report</li>
      </UL>
      <P>
        Before community stock information is used outside your personal account, we remove or
        exclude information intended to identify the contributor.
      </P>

      <H2>2. Separation of Personal Information and Community Data</H2>
      <P>MedScout is designed to separate:</P>
      <UL>
        <li>
          <span className="text-[#F0F6FC]">Identifying and account information</span>, such as
          your email address, phone numbers, addresses, account credentials, push token, and
          personal profile information; and
        </li>
        <li>
          <span className="text-[#F0F6FC]">Community medication availability information</span>,
          such as a medication&rsquo;s reported stock status at a pharmacy or in a geographic area.
        </li>
      </UL>
      <P>
        Your identity is not included in community stock reports made available to other users or
        commercial customers.
      </P>
      <P>
        We do not sell or provide your email address, phone number, home address, account
        credentials, push-notification token, or other direct identifying information as part of
        our community data products.
      </P>

      <H2>3. Information We May Sell or License</H2>
      <P>
        MedScout may sell, license, or otherwise make available{' '}
        <span className="text-[#F0F6FC]">
          scrubbed, de-identified, or aggregated medication availability data
        </span>{' '}
        reported by community members.
      </P>
      <P>This may include information such as:</P>
      <UL>
        <li>Medication and strength</li>
        <li>Reported stock status</li>
        <li>Pharmacy or pharmacy-area information</li>
        <li>ZIP code or geographic area</li>
        <li>Reported date or time</li>
        <li>Expected restock information</li>
      </UL>
      <P>
        This data is collected anonymously from the moment you submit it &mdash; a community
        report is never linked to your account or identity in our systems in the first place, so
        there is no identifying information to remove before sharing it. We do not sell the
        contributor&rsquo;s identity or provide buyers with a way to look up who submitted a
        report.
      </P>
      <P>Commercial customers may use this information for purposes such as:</P>
      <UL>
        <li>Medication availability analysis</li>
        <li>Supply and shortage monitoring</li>
        <li>Healthcare operations</li>
        <li>Research and market analysis</li>
        <li>Planning and forecasting</li>
      </UL>
      <P>
        We do not knowingly sell community data in a form that includes the contributor&rsquo;s
        email address, phone number, home address, account identity, or other direct personal
        identifiers.
      </P>

      <H2>4. How We Use Information</H2>
      <P>We may use information to:</P>
      <UL>
        <li>Create and manage your account</li>
        <li>Provide medication search and pharmacy-tracking features</li>
        <li>Generate call scripts and reminders</li>
        <li>Send availability and refill notifications you request</li>
        <li>Display community stock information</li>
        <li>Improve MedScout&rsquo;s features and reliability</li>
        <li>Prevent fraud, abuse, and unauthorized access</li>
        <li>Maintain security and troubleshoot technical issues</li>
        <li>Comply with legal obligations</li>
        <li>Create de-identified or aggregated analytics and commercial data products</li>
      </UL>
      <P>
        We do not use your private medication profile or personal account information to identify
        you to commercial data customers.
      </P>

      <H2>5. Information We Do Not Sell</H2>
      <P>We do not sell or rent:</P>
      <UL>
        <li>Email addresses</li>
        <li>Phone numbers</li>
        <li>Home addresses</li>
        <li>Personal names</li>
        <li>Account credentials</li>
        <li>Push-notification tokens</li>
        <li>Direct identifiers</li>
        <li>Private pharmacy-vault entries</li>
        <li>Personal medication profiles linked to your identity</li>
        <li>Private call notes</li>
      </UL>
      <P>
        We may share information with service providers that help us operate MedScout, but those
        providers may only use the information to provide services to us and are not authorized to
        sell your personal information independently.
      </P>

      <H2>6. Private Information and Community Contributions</H2>
      <P>
        Some MedScout features allow you to keep information private, including private pharmacy
        entries and personal call notes.
      </P>
      <P>
        If you contribute a stock report to the community, that contribution may be used to update
        availability information for other users and may be included in de-identified commercial
        data products.
      </P>
      <P>
        You should not include your name, phone number, address, or other identifying details in a
        community report or free-text field intended for stock information.
      </P>

      <H2>7. Location Information</H2>
      <P>MedScout may use pharmacy locations, ZIP codes, or approximate geographic areas to:</P>
      <UL>
        <li>Find nearby pharmacies</li>
        <li>Match stock reports to nearby users</li>
        <li>Send location-relevant availability alerts</li>
        <li>Display availability information geographically</li>
      </UL>
      <P>
        We aim to limit the precision of location information used in community and commercial
        data products. Directly identifying location information associated with your account is
        not sold as personal data.
      </P>

      <H2>8. Notifications</H2>
      <P>If you enable push notifications, MedScout may use your device&rsquo;s push-notification token to send:</P>
      <UL>
        <li>Medication availability alerts</li>
        <li>Refill reminders</li>
        <li>Check-back reminders</li>
        <li>Account or service notifications</li>
      </UL>
      <P>
        Medication availability alerts are opt-in on a per-medication basis, off by default
        &mdash; see Section 1. You can disable notifications for any single medication, or
        entirely, through your device or MedScout settings.
      </P>

      <H2>9. Third-Party Services</H2>
      <P>MedScout may use third-party providers for services such as:</P>
      <UL>
        <li>Hosting and database infrastructure</li>
        <li>Authentication through Apple or Google</li>
        <li>Push notifications</li>
        <li>Pharmacy and map data</li>
        <li>Medication and shortage information</li>
        <li>Security, monitoring, and technical operations</li>
      </UL>
      <P>
        These providers may process information on our behalf. We do not permit them to use your
        personal information for purposes unrelated to providing services to MedScout, except
        where required by law or separately authorized by you.
      </P>
      <P>
        Current product integrations may include Google services, Apple services, Expo push
        notifications, and public medication or shortage data sources.
      </P>

      <H2>10. Data Retention</H2>
      <P>
        We retain account and service information for as long as necessary to provide MedScout,
        maintain security, comply with legal obligations, resolve disputes, and enforce
        agreements.
      </P>
      <P>When you delete your account, we will delete or de-identify account-linked information within a reasonable period, subject to:</P>
      <UL>
        <li>Legal retention requirements</li>
        <li>Security and fraud-prevention needs</li>
        <li>Backups and disaster-recovery systems</li>
        <li>Previously published de-identified community data that can no longer reasonably be linked to you</li>
      </UL>
      <P>
        Community stock reports are never linked to your account in the first place, so they are
        unaffected by account deletion and may continue to be retained and used.
      </P>

      <H2>11. Security</H2>
      <P>
        We use reasonable administrative, technical, and organizational safeguards designed to
        protect information from unauthorized access, loss, misuse, alteration, or disclosure.
      </P>
      <P>
        No internet-based service can guarantee absolute security. You are responsible for
        maintaining the confidentiality of your account credentials and notifying us if you
        believe your account has been compromised.
      </P>

      <H2>12. Your Choices and Rights</H2>
      <P>Depending on where you live, you may have rights to:</P>
      <UL>
        <li>Access personal information we maintain about you</li>
        <li>Correct inaccurate information</li>
        <li>Delete your account and personal information</li>
        <li>Withdraw consent for optional processing</li>
        <li>Disable push notifications</li>
        <li>Request information about how your data is used</li>
        <li>Opt out of certain sales or sharing activities</li>
        <li>Appeal a privacy-rights decision</li>
      </UL>
      <P>To make a privacy request, contact us at:</P>
      <p className="mb-4 leading-relaxed text-[#F0F6FC]">
        Privacy contact: privacy@getmedscout.com
        <br />
        Company: MedScout
        <br />
        Address: 4 New Hampshire Ct, Rexford, NY 12148
      </p>
      <P>We may need to verify your identity before completing a request.</P>

      <H2>13. Children&rsquo;s Privacy</H2>
      <P>
        MedScout is not directed to children under 13. Parents or caregivers may use certain
        features to manage medication information for a child or dependent, but the adult account
        holder remains responsible for providing that information lawfully and appropriately.
      </P>

      <H2>14. Medical Disclaimer</H2>
      <P>
        MedScout provides medication availability and organizational tools. It does not provide
        medical advice, diagnosis, treatment recommendations, or emergency services.
      </P>
      <P>
        Medication availability information may be incomplete, delayed, or inaccurate. Always
        confirm availability and medication decisions with a pharmacist or qualified healthcare
        professional.
      </P>

      <H2>15. Changes to This Policy</H2>
      <P>
        We may update this Privacy Policy from time to time. When we make material changes, we
        will update the effective date and provide notice through the MedScout service or another
        reasonable method.
      </P>

      <H2>16. Contact Us</H2>
      <P>For privacy questions or requests, contact:</P>
      <p className="mb-4 leading-relaxed text-[#F0F6FC]">
        Email: privacy@getmedscout.com
        <br />
        Company: MedScout
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
