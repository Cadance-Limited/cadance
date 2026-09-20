import { Nav } from "@/components/site/nav";
import { Hero } from "@/components/site/hero";
import { TrustBar } from "@/components/site/trust-bar";
import { FeaturesBento } from "@/components/site/features-bento";
import { HowItWorks } from "@/components/site/how-it-works";
import { LiveDemo } from "@/components/site/live-demo";
import { UseCases } from "@/components/site/use-cases";
import { Testimonial } from "@/components/site/testimonial";
import { Comparison } from "@/components/site/comparison";
import { Security } from "@/components/site/security";
import { Pricing } from "@/components/site/pricing";
import { FAQ } from "@/components/site/faq";
import { CTAEmail } from "@/components/site/cta-email";
import { Footer } from "@/components/site/footer";
import { CommandPalette } from "@/components/site/command-palette";
import { BackToTop } from "@/components/site/back-to-top";
import { StickyDemoCTA } from "@/components/site/sticky-demo-cta";
import { CookieConsent } from "@/components/site/cookie-consent";
import { SectionDivider } from "@/components/site/section-divider";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Nav />
      <main className="flex-1">
        <Hero />
        <TrustBar />
        <SectionDivider />
        <FeaturesBento />
        <SectionDivider />
        <HowItWorks />
        <SectionDivider />
        <LiveDemo />
        <SectionDivider />
        <UseCases />
        <SectionDivider />
        <Testimonial />
        <SectionDivider />
        <Comparison />
        <SectionDivider />
        <Security />
        <SectionDivider />
        <Pricing />
        <SectionDivider />
        <FAQ />
        <SectionDivider />
        <CTAEmail />
      </main>
      <Footer />
      <CommandPalette />
      <BackToTop />
      <StickyDemoCTA />
      <CookieConsent />
    </div>
  );
}
