import DownloadSection from 'landing-app/components/sections/download';
import FaqSection from 'landing-app/components/sections/faq';
import FeatureSection from 'landing-app/components/sections/feature-section';
import HowItWorksSection from 'landing-app/components/sections/how-it-works';
import IntegrationSection from 'landing-app/components/sections/integration-section';
import LandingHero from 'landing-app/components/sections/landing-hero';
import TestimonialsSection from 'landing-app/components/sections/testimonials';

export default function Home() {
  return (
    <main className="flex-1">
      <LandingHero />
      <FeatureSection />
      <HowItWorksSection />
      <IntegrationSection />
      <TestimonialsSection />
      <DownloadSection />
      <FaqSection />
    </main>
  );
}
