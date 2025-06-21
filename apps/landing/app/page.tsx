import LandingHero from "@/components/sections/landing-hero";
import FeatureSection from "@/components/sections/feature-section";
import HowItWorksSection from "@/components/sections/how-it-works";
import TestimonialsSection from "@/components/sections/testimonials";
import DownloadSection from "@/components/sections/download";
import FaqSection from "@/components/sections/faq";
import IntegrationSection from "@/components/sections/integration-section";
import TopographyBackground from "@/components/ui/topography-background";
import AdvancedGridBackground from "@/components/ui/advanced-grid-background";

export default function Home() {
  return (
    <div className="relative flex min-h-screen flex-col">
      <div className="absolute inset-0 -z-10 h-full w-full bg-noise-texture bg-repeat"></div>
      <TopographyBackground />
      <AdvancedGridBackground />
      <main className="flex-1">
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
