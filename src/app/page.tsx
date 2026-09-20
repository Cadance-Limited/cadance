import { Nav } from "@/components/site/nav";
import { Hero } from "@/components/site/hero";
import { TrustBar } from "@/components/site/trust-bar";
import { FeaturesBento } from "@/components/site/features-bento";
import { HowItWorks } from "@/components/site/how-it-works";
import { LiveDemo } from "@/components/site/live-demo";
import { Testimonial } from "@/components/site/testimonial";
import { Pricing } from "@/components/site/pricing";
import { FAQ } from "@/components/site/faq";
import { CTAEmail } from "@/components/site/cta-email";
import { Footer } from "@/components/site/footer";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Nav />
      <main className="flex-1">
        <Hero />
        <TrustBar />
        <FeaturesBento />
        <HowItWorks />
        <LiveDemo />
        <Testimonial />
        <Pricing />
        <FAQ />
        <CTAEmail />
      </main>
      <Footer />
    </div>
  );
}
