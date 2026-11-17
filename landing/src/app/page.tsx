import { HeroSection } from '@/components/HeroSection'
import { FeaturesSection } from '@/components/FeaturesSection'
import { CTASection } from '@/components/CTASection'
import { getQrSvg } from '@/lib/qr'

export default async function Home() {
  // Generated at build time; the page stays static.
  const qrSvg = await getQrSvg()
  return (
    <>
      <HeroSection qrSvg={qrSvg} />
      <FeaturesSection />
      <CTASection qrSvg={qrSvg} />
    </>
  )
}
