import LandingHero from "landing-app/components/sections/landing-hero"
import FeatureSection from "landing-app/components/sections/feature-section"
import HowItWorksSection from "landing-app/components/sections/how-it-works"
import TestimonialsSection from "landing-app/components/sections/testimonials"
import DownloadSection from "landing-app/components/sections/download"
import FaqSection from "landing-app/components/sections/faq"
import IntegrationSection from "landing-app/components/sections/integration-section"
import TopographyBackground from "landing-app/components/ui/topography-background"
import AdvancedGridBackground from "landing-app/components/ui/advanced-grid-background"

export default function Home() {
  return (
    <div className='relative flex min-h-screen flex-col'>
      <div className='absolute inset-0 -z-10 h-full w-full bg-noise-texture bg-repeat'></div>
      <TopographyBackground />
      <AdvancedGridBackground />
      <main className='flex-1'>
        <LandingHero />
        <FeatureSection />
        <HowItWorksSection />
        <IntegrationSection />
        <TestimonialsSection />
        <DownloadSection />
        <FaqSection />
      </main>
    </div>
  );
}
