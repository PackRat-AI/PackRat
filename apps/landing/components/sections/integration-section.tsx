import { siteConfig } from "@/config/site";
import { LucideIcon } from "@/lib/icons";
import GradientText from "@/components/ui/gradient-text";
import GradientBackground from "@/components/ui/gradient-background";
import GradientBorderCard from "@/components/ui/gradient-border-card";

export default function IntegrationSection() {
  return (
    <section id="integrations" className="py-20 md:py-28 lg:py-36 relative overflow-hidden">
      {/* Background pattern */}
      <GradientBackground variant="mesh" />

      <div className="container px-4 md:px-8 lg:px-12">
        <div className="mx-auto max-w-3xl text-center mb-12 md:mb-16">
          <GradientBorderCard
            className="inline-block py-1 px-4 text-sm font-medium mb-4"
            containerClassName="inline-block"
            gradientClassName="bg-gradient-to-r from-primary via-secondary to-primary"
          >
            <GradientText>Powerful Ecosystem</GradientText>
          </GradientBorderCard>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {siteConfig.integrations.title}
          </h2>
          <p className="mt-6 text-base md:text-lg text-muted-foreground max-w-2xl mx-auto">
            {siteConfig.integrations.subtitle}
          </p>
        </div>

        <div className="grid gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {siteConfig.integrations.items.map((integration) => {
            const Icon = LucideIcon(integration.icon);

            return (
              <GradientBorderCard
                key={integration.id}
                className="h-full bg-card/80 backdrop-blur-sm"
                gradientClassName={`bg-gradient-to-br from-[${integration.color}] to-transparent`}
              >
                <div className="flex items-center gap-4 mb-4">
                  <div
                    className="flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-xl transition-colors duration-200"
                    style={{ background: `${integration.color}15` }}
                  >
                    {Icon && (
                      <Icon
                        className="h-5 w-5 md:h-6 md:w-6 transition-transform duration-300 group-hover:scale-110"
                        style={{ color: integration.color }}
                      />
                    )}
                  </div>
                  <div>
                    <h3 className="text-base md:text-lg font-bold text-foreground">
                      {integration.name}
                    </h3>
                    <p className="text-xs md:text-sm text-muted-foreground">
                      {integration.description}
                    </p>
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap gap-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-6 md:h-8 rounded-full px-2 md:px-3 flex items-center text-xs font-medium"
                      style={{
                        background: `${integration.color}10`,
                        color: integration.color,
                      }}
                    >
                      Feature {i + 1}
                    </div>
                  ))}
                </div>
              </GradientBorderCard>
            );
          })}
        </div>

        <div className="mt-12 md:mt-16 text-center">
          <GradientText
            className="text-base md:text-lg font-medium"
            gradient="bg-gradient-to-r from-primary via-secondary to-primary bg-[length:200%_100%] animate-gradient"
          >
            More integrations coming soon!
          </GradientText>
        </div>
      </div>
    </section>
  );
}
