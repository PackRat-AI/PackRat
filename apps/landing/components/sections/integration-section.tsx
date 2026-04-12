import { siteConfig } from 'landing-app/config/site';
import { LucideIcon } from 'landing-app/lib/icons';

export default function IntegrationSection() {
  return (
    <section id="integrations" className="py-20 md:py-28 lg:py-36 relative overflow-hidden">
      <div className="container">
        <div className="mx-auto max-w-3xl text-center mb-12 md:mb-16">
          <div className="apple-badge mb-4">Powerful Ecosystem</div>
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight sm:text-4xl">
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
              <div key={integration.id} className="apple-card h-full">
                <div className="flex items-center gap-4 mb-4">
                  <div
                    className="flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-full"
                    style={{ background: `${integration.color}15` }}
                  >
                    {Icon && (
                      <Icon
                        className="h-5 w-5 md:h-6 md:w-6"
                        style={{ color: integration.color }}
                      />
                    )}
                  </div>
                  <div>
                    <h3 className="text-base md:text-lg font-semibold text-foreground">
                      {integration.name}
                    </h3>
                    <p className="text-xs md:text-sm text-muted-foreground">
                      {integration.description}
                    </p>
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap gap-2">
                  {(integration.features ?? []).map((feature) => (
                    <div
                      key={feature}
                      className="h-6 md:h-7 rounded-full px-2 md:px-3 flex items-center text-xs font-medium"
                      style={{
                        background: `${integration.color}10`,
                        color: integration.color,
                      }}
                    >
                      {feature}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-12 md:mt-16 text-center text-base md:text-lg font-medium text-muted-foreground">
          More integrations on the way — stay tuned!
        </div>
      </div>
    </section>
  );
}
