import DeviceMockup from 'landing-app/components/ui/device-mockup';
import FeatureCard from 'landing-app/components/ui/feature-card';
import { siteConfig } from 'landing-app/config/site';
import { Check, ChevronRight } from 'lucide-react';
import Link from 'next/link';

export default function FeatureSection() {
  return (
    <section id="features" className="py-20 md:py-28 lg:py-36 relative overflow-hidden">
      <div className="container">
        <div className="mx-auto max-w-3xl text-center mb-12 md:mb-20">
          <div className="apple-badge mb-4">Powerful Features</div>
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight sm:text-4xl">
            Everything you need for your{' '}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-apple-blue to-blue-400">
              outdoor adventures
            </span>
          </h2>
          <p className="mt-6 text-base md:text-lg lg:text-xl text-muted-foreground max-w-2xl mx-auto">
            PackRat combines powerful features to make your outdoor trips more organized and
            enjoyable, whether you're a weekend camper or a seasoned backpacker.
          </p>
        </div>

        <div className="grid gap-12 md:gap-16">
          {/* Feature showcase 1 */}
          <div className="apple-card p-0 overflow-hidden">
            <div className="grid gap-8 md:grid-cols-2 items-center p-6 md:p-8">
              <div className="order-2 md:order-1">
                <div className="space-y-4 md:space-y-6">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/20">
                    <svg
                      className="w-6 h-6 text-apple-blue"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <title>Clipboard icon</title>
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                      />
                    </svg>
                  </div>
                  <h3 className="text-xl md:text-2xl font-semibold text-foreground">
                    {siteConfig.features[0].title}
                  </h3>
                  <p className="text-base md:text-lg leading-relaxed text-muted-foreground">
                    {siteConfig.features[0].description}
                  </p>
                  <ul className="space-y-2">
                    <li className="flex items-center">
                      <Check className="w-5 h-5 mr-2 text-apple-blue flex-shrink-0" />
                      <span>Customizable packing templates</span>
                    </li>
                    <li className="flex items-center">
                      <Check className="w-5 h-5 mr-2 text-apple-blue flex-shrink-0" />
                      <span>Weather-based recommendations</span>
                    </li>
                    <li className="flex items-center">
                      <Check className="w-5 h-5 mr-2 text-apple-blue flex-shrink-0" />
                      <span>Weight and space optimization</span>
                    </li>
                  </ul>
                </div>
              </div>
              <div className="order-1 md:order-2 flex justify-center">
                <DeviceMockup
                  image="/images/features/my-packs.png"
                  alt="Smart Packing Lists"
                  showReflection
                />
              </div>
            </div>
          </div>

          {/* Feature showcase 2 */}
          <div className="apple-card p-0 overflow-hidden">
            <div className="grid gap-8 md:grid-cols-2 items-center p-6 md:p-8">
              <div className="flex justify-center">
                <DeviceMockup
                  image="/images/features/weather-forecast.png"
                  alt="Trail Maps & Navigation"
                  showReflection
                />
              </div>
              <div>
                <div className="space-y-4 md:space-y-6">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/20">
                    <svg
                      className="w-6 h-6 text-apple-green"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <title>Map icon</title>
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                      />
                    </svg>
                  </div>
                  <h3 className="text-xl md:text-2xl font-semibold text-foreground">
                    {siteConfig.features[1].title}
                  </h3>
                  <p className="text-base md:text-lg leading-relaxed text-muted-foreground">
                    {siteConfig.features[1].description}
                  </p>
                  <ul className="space-y-2">
                    <li className="flex items-center">
                      <Check className="w-5 h-5 mr-2 text-apple-green flex-shrink-0" />
                      <span>Offline map downloads</span>
                    </li>
                    <li className="flex items-center">
                      <Check className="w-5 h-5 mr-2 text-apple-green flex-shrink-0" />
                      <span>GPS tracking and waypoints</span>
                    </li>
                    <li className="flex items-center">
                      <Check className="w-5 h-5 mr-2 text-apple-green flex-shrink-0" />
                      <span>Elevation profiles and difficulty ratings</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Feature showcase 3 */}
          <div className="apple-card p-0 overflow-hidden">
            <div className="grid gap-8 md:grid-cols-2 items-center p-6 md:p-8">
              <div className="order-2 md:order-1">
                <div className="space-y-4 md:space-y-6">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/20">
                    <svg
                      className="w-6 h-6 text-apple-purple"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <title>Open Book icon</title>
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 6c-1.5-1-3.5-2-6-2s-4 1-4 1v14s1-1 4-1 4.5 1 6 2m0-14c1.5-1 3.5-2 6-2s4 1 4 1v14s-1-1-4-1-4.5 1-6 2m0-14v14"
                      />
                    </svg>
                  </div>
                  <h3 className="text-xl md:text-2xl font-semibold text-foreground">
                    {siteConfig.features[2]?.title}
                  </h3>
                  <p className="text-base md:text-lg leading-relaxed text-muted-foreground">
                    {siteConfig.features[2]?.description}
                  </p>
                  <ul className="space-y-2">
                    <li className="flex items-center">
                      <Check className="w-5 h-5 mr-2 text-apple-purple flex-shrink-0" />
                      <span>Destination highlights and recommendations</span>
                    </li>
                    <li className="flex items-center">
                      <Check className="w-5 h-5 mr-2 text-apple-purple flex-shrink-0" />
                      <span>Safety and survival tips</span>
                    </li>
                    <li className="flex items-center">
                      <Check className="w-5 h-5 mr-2 text-apple-purple flex-shrink-0" />
                      <span>Expert gear recommendations</span>
                    </li>
                  </ul>
                  <div className="pt-4">
                    <Link
                      href={siteConfig.cta.tertiary.href}
                      className="inline-flex items-center gap-1 text-sm font-medium text-apple-blue hover:underline"
                    >
                      {siteConfig.cta.tertiary.text}
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              </div>
              <div className="order-1 md:order-2 flex justify-center">
                <DeviceMockup image="/images/features/guides-ios.png" alt="Guides" showReflection />
              </div>
            </div>
          </div>

          {/* Other features grid */}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {siteConfig.features.slice(3).map((feature) => (
              <div key={feature.id} className="apple-card">
                <FeatureCard
                  title={feature.title}
                  description={feature.description}
                  icon={feature.icon}
                  color={feature.color}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
