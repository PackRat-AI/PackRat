import { siteConfig } from 'landing-app/config/site';
import { LucideIcon, TikTokIcon } from 'landing-app/lib/icons';
import { Backpack } from 'lucide-react';
import Link from 'next/link';

export default function SiteFooter() {
  return (
    <footer className="border-t border-border/40 py-10 md:py-14 lg:py-16 bg-apple-gray-light dark:bg-gray-900/20">
      <div className="container">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {/* Brand column */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Backpack className="h-5 w-5 text-apple-blue" />
              <span className="text-lg font-semibold">{siteConfig.name}</span>
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              Your ultimate companion for outdoor adventures.
            </p>
            <div className="flex gap-4">
              {siteConfig.social.map((item) => {
                const Icon = item.icon !== 'TikTok' ? LucideIcon(item.icon) : null;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className="text-gray-500 hover:text-apple-blue transition-colors"
                  >
                    <span className="sr-only">{item.name}</span>
                    {item.icon === 'TikTok' ? (
                      <TikTokIcon className="h-5 w-5" />
                    ) : (
                      Icon && <Icon className="h-5 w-5" />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Product links */}
          <div>
            <h3 className="text-sm font-semibold mb-4">Product</h3>
            <ul className="space-y-3">
              {siteConfig.footerLinks.product.map((item) => (
                <li key={item.title}>
                  <Link
                    href={item.href}
                    className="text-sm text-muted-foreground hover:text-apple-blue transition-colors"
                  >
                    {item.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company links */}
          <div>
            <h3 className="text-sm font-semibold mb-4">Company</h3>
            <ul className="space-y-3">
              {siteConfig.footerLinks.company.map((item) => (
                <li key={item.title}>
                  <Link
                    href={item.href}
                    className="text-sm text-muted-foreground hover:text-apple-blue transition-colors"
                  >
                    {item.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal links */}
          <div>
            <h3 className="text-sm font-semibold mb-4">Legal</h3>
            <ul className="space-y-3">
              {siteConfig.footerLinks.legal.map((item) => (
                <li key={item.title}>
                  <Link
                    href={item.href}
                    className="text-sm text-muted-foreground hover:text-apple-blue transition-colors"
                  >
                    {item.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-10 md:mt-12 border-t border-gray-200 dark:border-gray-800 pt-6 text-center text-sm text-gray-500">
          <p>
            © {new Date().getFullYear()} {siteConfig.name}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
