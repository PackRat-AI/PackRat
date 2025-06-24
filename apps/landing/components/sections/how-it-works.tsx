import { siteConfig } from 'landing-app/config/site';
import GradientText from 'landing-app/components/ui/gradient-text';
import GradientBorderCard from 'landing-app/components/ui/gradient-border-card';
import { LucideIcon } from 'landing-app/lib/icons';

export default function HowItWorksSection() {
  // Icons for each step
  const stepIcons = ['Download', 'Map', 'Backpack'];

  return (
    <section
      id="how-it-works"
      className="py-20 md:py-28 lg:py-36 relative overflow-hidden bg-muted"
    >
      {/* Background patterns */}
      <div className="absolute inset-0 overflow-hidden opacity-5 -z-10">
        <div className="absolute top-0 left-0 w-full h-full">
          <div className="absolute top-0 right-0 w-1/3 h-1/3 bg-gradient-to-bl from-foreground/20 to-transparent blur-3xl"></div>
          <div className="h-full w-full bg-[radial-gradient(#000000_1px,transparent_1px)] dark:bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:20px_20px]"></div>
        </div>
      </div>

      <div className="container px-4 md:px-8 lg:px-12">
        <div className="mx-auto max-w-3xl text-center mb-12 md:mb-20">
          <GradientBorderCard
            className="inline-block py-1 px-4 text-sm font-medium mb-4"
            containerClassName="inline-block"
            gradientClassName="bg-gradient-to-r from-orange-500 to-orange-300 dark:from-orange-400 dark:to-orange-200"
          >
            <GradientText gradient="bg-gradient-to-r from-orange-500 to-orange-300 dark:from-orange-400 dark:to-orange-200">
              Simple Process
            </GradientText>
          </GradientBorderCard>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {siteConfig.howItWorks.title}
          </h2>
          <p className="mt-6 text-base md:text-lg lg:text-xl text-muted-foreground max-w-2xl mx-auto">
            {siteConfig.howItWorks.subtitle}
          </p>
        </div>

        {/* Fixed stepper layout */}
        <div className="relative">
          {/* Connected line that properly shows the flow - visible only on larger screens */}
          <div className="absolute left-1/2 top-12 h-[calc(100%-5rem)] w-[2px] -translate-x-1/2 bg-gradient-to-b from-orange-300 via-orange-300 to-transparent lg:left-1/2 lg:top-1/2 lg:h-[2px] lg:w-[calc(100%-15rem)] lg:-translate-y-1/2 lg:bg-gradient-to-r hidden md:block" />

          <div className="grid gap-8 md:gap-12 lg:gap-16 lg:grid-cols-3">
            {siteConfig.howItWorks.steps.map((step, index) => {
              const Icon = LucideIcon(stepIcons[index]);

              return (
                <div key={step.number} className="relative flex flex-col items-center text-center">
                  {/* Step number indicator with fixed styling */}
                  <div className="relative mb-6 md:mb-8">
                    <div className="absolute -inset-3 rounded-full bg-gradient-to-r from-orange-300 to-orange-400 opacity-30 blur-md" />
                    <div className="relative z-10 flex h-14 w-14 md:h-16 md:w-16 items-center justify-center rounded-full border-2 border-orange-300 bg-background">
                      <GradientText
                        className="text-xl md:text-2xl font-bold"
                        gradient="bg-gradient-to-r from-orange-400 to-orange-500"
                      >
                        {step.number}
                      </GradientText>
                    </div>
                  </div>

                  <div className="bg-card/80 backdrop-blur-sm rounded-xl border border-border/40 p-4 md:p-6 w-full h-full">
                    <div className="flex flex-col items-center h-full">
                      {Icon && (
                        <div className="mb-4 p-3 rounded-full bg-orange-100 dark:bg-orange-900/20">
                          <Icon className="h-6 w-6 md:h-8 md:w-8 text-orange-500" />
                        </div>
                      )}
                      <h3 className="text-lg md:text-xl font-bold text-foreground mb-2 md:mb-3">
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
