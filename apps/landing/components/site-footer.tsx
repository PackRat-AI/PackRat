'use client';

import type React from 'react';
import Link from 'next/link';
import { Backpack } from 'lucide-react';
import { siteConfig } from '@/config/site';
import { LucideIcon } from '@/lib/icons';
import GradientText from '@/components/ui/gradient-text';
import GradientBorderCard from '@/components/ui/gradient-border-card';

export default function SiteFooter() {
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
    <footer className="border-t py-10 md:py-14 lg:py-16 relative border-border">
      {/* Background pattern */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 opacity-5 bg-gradient-mesh"></div>
      </div>

      <div className="container px-4 md:px-8 lg:px-12">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Backpack className="h-6 w-6 text-primary" />
              <GradientText
                className="text-lg font-bold"
                gradient="bg-gradient-to-r from-primary via-secondary to-primary bg-[length:200%_100%] animate-gradient"
              >
                {siteConfig.name}
              </GradientText>
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              Your ultimate companion for outdoor adventures.
            </p>
            <div className="flex gap-4">
              {siteConfig.social.map((item) => {
                const Icon = LucideIcon(item.icon);

                return (
                  <GradientBorderCard
                    key={item.name}
                    className="p-2 bg-card/80"
                    containerClassName="w-fit h-fit"
                  >
                    <Link
                      href={item.href}
                      className="text-muted-foreground hover:text-primary transition-colors"
                    >
                      <span className="sr-only">{item.name}</span>
                      {Icon && <Icon className="h-5 w-5" />}
                    </Link>
                  </GradientBorderCard>
                );
              })}
            </div>
          </div>

          <div className="lg:ml-auto">
            <h3 className="font-medium text-foreground mb-4">Product</h3>
            <ul className="space-y-3">
              {siteConfig.footerLinks.product.map((item, index) => (
                <li key={index}>
                  <Link
                    href={item.href}
                    onClick={(e) => item.href.startsWith('#') && scrollToSection(e, item.href)}
                    className="text-sm text-muted-foreground hover:text-primary transition-colors"
                  >
                    {item.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-medium text-foreground mb-4">Company</h3>
            <ul className="space-y-3">
              {siteConfig.footerLinks.company.map((item, index) => (
                <li key={index}>
                  <Link
                    href={item.href}
                    onClick={(e) => item.href.startsWith('#') && scrollToSection(e, item.href)}
                    className="text-sm text-muted-foreground hover:text-primary transition-colors"
                  >
                    {item.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-medium text-foreground mb-4">Legal</h3>
            <ul className="space-y-3">
              {siteConfig.footerLinks.legal.map((item, index) => (
                <li key={index}>
                  <Link
                    href={item.href}
                    onClick={(e) => item.href.startsWith('#') && scrollToSection(e, item.href)}
                    className="text-sm text-muted-foreground hover:text-primary transition-colors"
                  >
                    {item.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-10 md:mt-12 border-t pt-6 text-center border-border/50">
          <GradientBorderCard className="inline-block py-2 px-4 bg-card/80">
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} {siteConfig.name}. All rights reserved.
            </p>
          </GradientBorderCard>
        </div>
      </div>
    </footer>
  );
}
