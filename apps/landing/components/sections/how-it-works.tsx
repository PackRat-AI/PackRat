import { siteConfig } from 'landing-app/config/site';
import { LucideIcon } from 'landing-app/lib/icons';
import { assertDefined } from 'landing-app/lib/typeAssertions';

export default function HowItWorksSection() {
  const stepIcons = ['Download', 'Map', 'Backpack'];

  return (
    <section
      id="how-it-works"
      className="py-20 md:py-28 lg:py-36 relative overflow-hidden bg-apple-gray-light dark:bg-gray-900/20"
    >
      <div className="container">
        <div className="mx-auto max-w-3xl text-center mb-12 md:mb-20">
          <div className="apple-badge mb-4">Simple Process</div>
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight sm:text-4xl">
            {siteConfig.howItWorks.title}
          </h2>
          <p className="mt-6 text-base md:text-lg lg:text-xl text-muted-foreground max-w-2xl mx-auto">
            {siteConfig.howItWorks.subtitle}
          </p>
        </div>

        {/* Step cards */}
        <div className="relative">
          {/* Connector line – visible on large screens */}
          <div className="absolute left-1/2 top-12 h-[calc(100%-5rem)] w-[2px] -translate-x-1/2 bg-gradient-to-b from-apple-blue/30 via-apple-blue/20 to-transparent lg:left-1/2 lg:top-1/2 lg:h-[2px] lg:w-[calc(100%-15rem)] lg:-translate-y-1/2 lg:bg-gradient-to-r hidden md:block" />

          <div className="grid gap-8 md:gap-12 lg:gap-16 lg:grid-cols-3">
            {siteConfig.howItWorks.steps.map((step, index) => {
              const icon = stepIcons[index];
              assertDefined(icon);
              const Icon = LucideIcon(icon);

              return (
                <div key={step.number} className="relative flex flex-col items-center text-center">
                  {/* Step number circle */}
                  <div className="relative mb-6 md:mb-8">
                    <div className="relative z-10 flex h-14 w-14 md:h-16 md:w-16 items-center justify-center rounded-full bg-apple-blue text-white shadow-apple">
                      <span className="text-xl md:text-2xl font-semibold">{step.number}</span>
                    </div>
                  </div>

                  <div className="apple-card p-4 md:p-6 w-full h-full">
                    <div className="flex flex-col items-center h-full">
                      {Icon && (
                        <div className="mb-4 p-3 rounded-full bg-blue-100 dark:bg-blue-900/20">
                          <Icon className="h-6 w-6 md:h-8 md:w-8 text-apple-blue" />
                        </div>
                      )}
                      <h3 className="text-lg md:text-xl font-semibold text-foreground mb-2 md:mb-3">
                        {step.title}
                      </h3>
                      <p className="text-sm md:text-base text-muted-foreground">
                        {step.description}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
