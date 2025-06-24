import { siteConfig } from 'landing-app/config/site';
import DeviceMockup from 'landing-app/components/ui/device-mockup';
import GradientText from 'landing-app/components/ui/gradient-text';
import FeatureCard from 'landing-app/components/ui/feature-card';
import { Check } from 'lucide-react';
import GradientBackground from 'landing-app/components/ui/gradient-background';
import GradientBorderCard from 'landing-app/components/ui/gradient-border-card';

export default function FeatureSection() {
  return (
    <section id="features" className="py-20 md:py-28 lg:py-36 relative overflow-hidden">
      {/* Background decorations */}
      <GradientBackground variant="mesh" />
      <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-gradient-to-br from-primary-50/30 via-primary-100/20 to-transparent blur-3xl dark:from-primary-900/20 dark:via-primary-800/10"></div>
      <div className="absolute top-1/4 right-0 w-1/3 h-1/3 bg-gradient-to-tl from-secondary-100/20 via-secondary-50/10 to-transparent blur-3xl dark:from-secondary-900/20 dark:via-secondary-800/10"></div>

      <div className="container px-4 md:px-8 lg:px-12">
        <div className="mx-auto max-w-3xl text-center mb-12 md:mb-20">
          <GradientBorderCard
            className="inline-block py-1 px-4 text-sm font-medium mb-4"
            containerClassName="inline-block"
            gradientClassName="bg-gradient-to-r from-primary via-secondary to-primary"
          >
            <GradientText>Powerful Features</GradientText>
          </GradientBorderCard>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Everything you need for your
            <GradientText
              className="block mt-1"
              gradient="bg-gradient-to-r from-primary via-secondary to-primary bg-[length:200%_100%] animate-gradient"
            >
              outdoor adventures
            </GradientText>
          </h2>
          <p className="mt-6 text-base md:text-lg lg:text-xl text-muted-foreground max-w-2xl mx-auto">
            PackRat combines powerful features to make your outdoor trips more organized and
            enjoyable, whether you're a weekend camper or a seasoned backpacker.
          </p>
        </div>

        <div className="grid gap-12 md:gap-16">
          {/* Feature showcase 1 */}
          <GradientBorderCard
            className="p-0 overflow-hidden bg-card/80 backdrop-blur-sm"
            interactive={false}
          >
            <div className="grid gap-8 md:grid-cols-2 items-center p-6 md:p-8">
              <div className="order-2 md:order-1">
                <div className="space-y-4 md:space-y-6">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/15 dark:bg-primary/10">
                    <svg
                      className="w-6 h-6 text-primary"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                      />
                    </svg>
                  </div>
                  <h3 className="text-xl md:text-2xl font-bold text-foreground">
                    {siteConfig.features[0].title}
                  </h3>
                  <p className="text-base md:text-lg text-muted-foreground">
                    {siteConfig.features[0].description}
                  </p>
                  <ul className="space-y-2">
                    <li className="flex items-center">
                      <Check className="w-5 h-5 mr-2 text-primary flex-shrink-0" />
                      <span>Customizable packing templates</span>
                    </li>
                    <li className="flex items-center">
                      <Check className="w-5 h-5 mr-2 text-primary flex-shrink-0" />
                      <span>Weather-based recommendations</span>
                    </li>
                    <li className="flex items-center">
                      <Check className="w-5 h-5 mr-2 text-primary flex-shrink-0" />
                      <span>Weight and space optimization</span>
                    </li>
                  </ul>
                </div>
              </div>
              <div className="order-1 md:order-2 mx-auto">
                <DeviceMockup
                  image="/feature-packing-list.png"
                  alt="Smart Packing Lists"
                  showReflection
                />
              </div>
            </div>
          </GradientBorderCard>

          {/* Feature showcase 2 */}
          <GradientBorderCard
            className="p-0 overflow-hidden bg-card/80 backdrop-blur-sm"
            interactive={false}
            gradientClassName="bg-gradient-to-r from-secondary via-primary to-secondary"
          >
            <div className="grid gap-8 md:grid-cols-2 items-center p-6 md:p-8">
              <div className="mx-auto">
                <DeviceMockup
                  image="/feature-trail-maps.png"
                  alt="Trail Maps & Navigation"
                  showReflection
                />
              </div>
              <div>
                <div className="space-y-4 md:space-y-6">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-secondary/15 dark:bg-secondary/10">
                    <svg
                      className="w-6 h-6 text-secondary"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                      />
                    </svg>
                  </div>
                  <h3 className="text-xl md:text-2xl font-bold text-foreground">
                    {siteConfig.features[1].title}
                  </h3>
                  <p className="text-base md:text-lg text-muted-foreground">
                    {siteConfig.features[1].description}
                  </p>
                  <ul className="space-y-2">
                    <li className="flex items-center">
                      <Check className="w-5 h-5 mr-2 text-secondary flex-shrink-0" />
                      <span>Offline map downloads</span>
                    </li>
                    <li className="flex items-center">
                      <Check className="w-5 h-5 mr-2 text-secondary flex-shrink-0" />
                      <span>GPS tracking and waypoints</span>
                    </li>
                    <li className="flex items-center">
                      <Check className="w-5 h-5 mr-2 text-secondary flex-shrink-0" />
                      <span>Elevation profiles and difficulty ratings</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </GradientBorderCard>

          {/* Other features grid */}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {siteConfig.features.slice(2).map((feature) => (
              <GradientBorderCard key={feature.id}>
                <FeatureCard
                  title={feature.title}
                  description={feature.description}
                  icon={feature.icon}
                  color={feature.color}
                />
              </GradientBorderCard>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
