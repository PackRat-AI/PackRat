'use client';

import type React from 'react';
import Link from 'next/link';
import { siteConfig } from '@/config/site';
import { Button } from '@/components/ui/button';
import { Check, Apple, Store } from 'lucide-react';
import GradientBackground from '@/components/ui/gradient-background';
import AnimatedGradientBorder from '@/components/ui/animated-gradient-border';

export default function DownloadSection() {
  // Handle smooth scrolling when clicking on navigation links
  const scrollToSection = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    const targetId = href.substring(1);
    const element = document.getElementById(targetId);

    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section id="download" className="py-20 md:py-28 lg:py-36 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 -z-10 bg-primary/5 dark:bg-primary/10"></div>
      <GradientBackground variant="mesh" />

      <div className="container px-4 md:px-8 lg:px-12">
        <AnimatedGradientBorder
          borderWidth={1}
          colors={['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--primary))']}
          className="rounded-2xl md:rounded-[40px] shadow-2xl overflow-hidden relative border animate-fade-in"
        >
          <div className="rounded-2xl md:rounded-[40px] bg-card shadow-2xl overflow-hidden relative">
            {/* Background gradient */}
            <div className="absolute inset-0 -z-10 opacity-5 bg-gradient-to-br from-primary via-primary/80 to-primary/60"></div>

            <div className="grid lg:grid-cols-2 items-center gap-8 md:gap-12 p-6 md:p-8 lg:p-12">
              <div className="space-y-4 md:space-y-6 max-w-xl">
                <div className="inline-flex items-center rounded-full py-1 px-4 text-sm font-medium border shadow-sm text-secondary border-secondary/30">
                  <span className="mr-1.5 h-2 w-2 rounded-full animate-pulse bg-secondary"></span>
                  Get Started Today
                </div>

                <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight text-foreground">
                  {siteConfig.download.title}
                </h2>

                <p className="text-base md:text-lg text-muted-foreground">
                  {siteConfig.download.subtitle}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                  {/* Modified features list to remove pricing references */}
                  <div className="flex items-start">
                    <div className="mr-2 mt-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary/15">
                      <Check className="h-3 w-3 text-primary" />
                    </div>
                    <span className="text-sm text-muted-foreground">Free to use</span>
                  </div>
                  <div className="flex items-start">
                    <div className="mr-2 mt-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary/15">
                      <Check className="h-3 w-3 text-primary" />
                    </div>
                    <span className="text-sm text-muted-foreground">Offline access</span>
                  </div>
                  <div className="flex items-start">
                    <div className="mr-2 mt-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary/15">
                      <Check className="h-3 w-3 text-primary" />
                    </div>
                    <span className="text-sm text-muted-foreground">Regular updates</span>
                  </div>
                  <div className="flex items-start">
                    <div className="mr-2 mt-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary/15">
                      <Check className="h-3 w-3 text-primary" />
                    </div>
                    <span className="text-sm text-muted-foreground">Community support</span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 pt-4">
                  <Button asChild size="lg" className="group relative overflow-hidden">
                    <Link
                      href={siteConfig.download.appStoreLink}
                      onClick={(e) => scrollToSection(e, siteConfig.download.appStoreLink)}
                    >
                      <div className="absolute inset-0 w-full h-full transition-all duration-300 ease-out translate-y-full group-hover:translate-y-0 bg-black/10 dark:bg-white/10"></div>
                      <Apple className="mr-2 h-5 w-5" />
                      App Store
                    </Link>
                  </Button>

                  <Button asChild size="lg" variant="outline" className="group">
                    <Link
                      href={siteConfig.download.googlePlayLink}
                      onClick={(e) => scrollToSection(e, siteConfig.download.googlePlayLink)}
                    >
                      <Store className="mr-2 h-5 w-5" />
                      Google Play
                    </Link>
                  </Button>
                </div>
              </div>

              <div className="relative mx-auto lg:mx-0">
                <div className="relative mx-auto max-w-[220px] md:max-w-[280px]">
                  <div
                    className="relative overflow-hidden rounded-[30px] md:rounded-[40px] border-[10px] md:border-[14px] bg-black aspect-[9/19.5] shadow-2xl shadow-black/20"
                    style={{ borderColor: '#1E293B' }}
                  >
                    <div className="absolute top-0 left-1/2 z-10 h-4 md:h-6 w-24 md:w-36 -translate-x-1/2 rounded-b-3xl bg-black"></div>
                    <div className="absolute inset-0 overflow-hidden">
                      <img
                        src={siteConfig.download.image || '/placeholder.svg'}
                        alt="PackRat App"
                        className="object-cover w-full h-full"
                      />
                      <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent opacity-80"></div>
                      <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent"></div>
                    </div>
                  </div>
                </div>

                {/* Decorative elements - only visible on larger screens */}
                <div className="absolute bottom-1/2 -left-12 transform -translate-x-1/2 translate-y-1/2 rotate-90 hidden lg:block">
                  <svg
                    width="120"
                    height="120"
                    viewBox="0 0 120 120"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="opacity-10 text-primary"
                  >
                    <circle cx="60" cy="60" r="59.5" stroke="currentColor" strokeDasharray="4 4" />
                  </svg>
                </div>
                <div className="absolute -top-10 -right-10 hidden lg:block">
                  <svg
                    width="80"
                    height="80"
                    viewBox="0 0 80 80"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="opacity-20 text-secondary"
                  >
                    <path d="M80 0H0V80H80V0Z" fill="currentColor" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </AnimatedGradientBorder>
      </div>
    </section>
  );
}
