import DownloadSection from 'landing-app/components/sections/download';
import FaqSection from 'landing-app/components/sections/faq';
import FeatureSection from 'landing-app/components/sections/feature-section';
import HowItWorksSection from 'landing-app/components/sections/how-it-works';
import IntegrationSection from 'landing-app/components/sections/integration-section';
import LandingHero from 'landing-app/components/sections/landing-hero';
import TestimonialsSection from 'landing-app/components/sections/testimonials';

export default function Home() {
  return (
    <div className="relative flex min-h-screen flex-col">
      {/* Static dot-grid background — SSR-safe, zero JS, zero layout shift */}
      <div className="absolute inset-0 -z-10 [background-image:radial-gradient(hsl(var(--foreground)/0.07)_1px,transparent_1px)] [background-size:40px_40px]" />
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
