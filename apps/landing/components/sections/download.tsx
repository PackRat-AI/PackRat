import { siteConfig } from 'landing-app/config/site';
import { Apple, Check, Store } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

export default function DownloadSection() {
  return (
    <section id="download" className="py-20 md:py-28 lg:py-36 relative overflow-hidden">
      {/* Subtle Apple-style background gradient */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-blue-50 to-white dark:from-blue-950/20 dark:to-background" />

      <div className="container">
        <div className="apple-card overflow-hidden">
          <div className="grid lg:grid-cols-2 items-center gap-8 md:gap-12 p-6 md:p-8 lg:p-12">
            {/* Text content */}
            <div className="space-y-4 md:space-y-6 max-w-xl mx-auto lg:mx-0 text-center lg:text-left">
              <div className="apple-badge mx-auto lg:mx-0 w-fit">
                <span className="mr-1.5 h-2 w-2 rounded-full animate-pulse bg-apple-blue inline-block" />
                Get Started Today
              </div>

              <h2 className="text-2xl md:text-3xl lg:text-4xl font-semibold tracking-tight">
                {siteConfig.download.title}
              </h2>

              <p className="text-base md:text-lg text-muted-foreground">
                {siteConfig.download.subtitle}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 text-left">
                {['Free to use', 'Offline access', 'Regular updates', 'Community support'].map(
                  (item) => (
                    <div key={item} className="flex items-start gap-2">
                      <div className="mt-1 flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/20 flex-shrink-0">
                        <Check className="h-3 w-3 text-apple-blue" />
                      </div>
                      <span className="text-sm text-muted-foreground">{item}</span>
                    </div>
                  ),
                )}
              </div>

              <div className="flex flex-col sm:flex-row justify-center lg:justify-start gap-3 pt-4">
                <Link
                  href={siteConfig.download.appStoreLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-apple-blue text-white px-8 h-12 text-sm font-medium hover:bg-apple-blue/90 transition-colors"
                >
                  <Apple className="h-5 w-5" />
                  App Store
                </Link>

                <Link
                  href={siteConfig.download.googlePlayLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-background px-8 h-12 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                >
                  <Store className="h-5 w-5" />
                  Google Play
                </Link>
              </div>
            </div>

            {/* Phone mockup */}
            <div className="relative mx-auto lg:mx-0">
              <div className="relative mx-auto max-w-[220px] md:max-w-[280px]">
                <div
                  className="relative overflow-hidden rounded-[30px] md:rounded-[40px] border-[10px] md:border-[14px] bg-white aspect-[9/19.5] shadow-apple-lg"
                  style={{ borderColor: '#1E293B' }}
                >
                  <div className="absolute top-0 left-1/2 z-10 h-4 md:h-6 w-24 md:w-36 -translate-x-1/2 rounded-b-3xl bg-black" />
                  <div className="absolute inset-0 overflow-hidden pt-4 md:pt-5">
                    <Image
                      fill
                      src={siteConfig.download.image || '/placeholder.svg'}
                      alt="PackRat App"
                      className="object-cover object-top"
                    />
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
