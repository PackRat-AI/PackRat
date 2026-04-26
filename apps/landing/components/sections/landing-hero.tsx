import DeviceMockup from 'landing-app/components/ui/device-mockup';
import { siteConfig } from 'landing-app/config/site';
import { ArrowRight, Download, Star } from 'lucide-react';
import Link from 'next/link';

export default function LandingHero() {
  return (
    <section className="relative py-24 overflow-hidden">
      {/* Subtle gradient background – Apple style */}
      <div className="absolute inset-0 bg-gradient-to-b from-blue-50 to-white dark:from-blue-950/20 dark:to-background -z-10" />

      <div className="container">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 items-center">
          {/* Text column */}
          <div className="space-y-6 max-w-2xl mx-auto lg:mx-0 text-center lg:text-left">
            {/* Badge */}
            <div className="animate-fade-up" style={{ animationDelay: '0.2s' }}>
              <div className="apple-badge mx-auto lg:mx-0 w-fit">
                <span className="mr-1.5 h-2 w-2 rounded-full bg-apple-blue animate-pulse inline-block" />
                {siteConfig.hero.badge}
              </div>
            </div>

            {/* Heading — rendered immediately for LCP */}
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl md:text-6xl">
              <span className="block text-foreground">{siteConfig.hero.titleLine1}</span>
              <span className="block mt-1 bg-clip-text text-transparent bg-gradient-to-r from-apple-blue to-blue-400">
                {siteConfig.hero.titleLine2}
              </span>
            </h1>

            {/* Subtitle — rendered immediately for LCP */}
            <p className="text-xl text-muted-foreground font-medium max-w-xl mx-auto lg:mx-0">
              {siteConfig.hero.subtitle}
            </p>

            {/* CTA buttons */}
            <div
              className="flex flex-col sm:flex-row justify-center lg:justify-start gap-3 animate-fade-up"
              style={{ animationDelay: '0.3s' }}
            >
              <Link
                href={siteConfig.cta.primary.href}
                className="group inline-flex items-center justify-center gap-2 rounded-full bg-apple-blue text-white px-8 h-12 text-sm font-medium hover:bg-apple-blue/90 transition-colors"
              >
                <Download className="h-4 w-4" />
                {siteConfig.cta.primary.text}
                <ArrowRight className="h-4 w-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200" />
              </Link>

              <Link
                href={siteConfig.cta.secondary.href}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-background px-8 h-12 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
              >
                {siteConfig.cta.secondary.text}
              </Link>
            </div>

            {/* Social proof */}
            {siteConfig.hero.socialProof && (
              <p
                className="text-xs text-muted-foreground flex items-center justify-center lg:justify-start gap-1 animate-fade-up"
                style={{ animationDelay: '0.4s' }}
              >
                <Star className="w-3 h-3 text-amber-400 fill-amber-400 flex-shrink-0" />
                {siteConfig.hero.socialProof}
              </p>
            )}

            {/* Stats */}
            <div
              className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-6 pt-4 animate-fade-up"
              style={{ animationDelay: '0.5s' }}
            >
              <div className="flex -space-x-2">
                {siteConfig.testimonials.items.slice(0, 4).map((user) => (
                  <div
                    key={user.id}
                    className="w-10 h-10 rounded-full border-2 border-background flex items-center justify-center overflow-hidden bg-blue-100 dark:bg-blue-900/30"
                  >
                    <span className="text-xs font-bold text-apple-blue">{user.initials}</span>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-4">
                {siteConfig.hero.stats.map((stat) => (
                  <div key={stat.label} className="text-center">
                    <div className="text-xl font-bold text-apple-blue">{stat.value}</div>
                    <div className="text-xs text-muted-foreground">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Device mockup column */}
          <div
            className="relative mx-auto lg:mx-0 animate-scale-in"
            style={{ animationDelay: '0.2s' }}
          >
            <DeviceMockup
              image="/images/app/dashboard.png"
              alt="PackRat App"
              priority
              showReflection
              showGradient
            />

            {/* Floating cards – Apple style: clean card with subtle shadow */}
            <div
              className="absolute top-[10%] -left-16 hidden lg:block animate-slide-in-left"
              style={{ animationDelay: '0.6s' }}
            >
              <div className="apple-card p-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center bg-amber-100 dark:bg-amber-900/30">
                    <Star className="w-4 h-4 text-amber-500" />
                  </div>
                  <div>
                    <div className="text-xs font-medium">App Store Rating</div>
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Star key={i} className="w-3 h-3 text-amber-400 fill-amber-400" />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div
              className="absolute bottom-[15%] -right-10 hidden lg:block animate-slide-in-right"
              style={{ animationDelay: '0.8s' }}
            >
              <div className="apple-card p-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center bg-blue-100 dark:bg-blue-900/30">
                    <Download className="w-4 h-4 text-apple-blue" />
                  </div>
                  <div>
                    <div className="text-xs font-medium">Downloads</div>
                    <div className="text-sm font-bold">10,000+</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
