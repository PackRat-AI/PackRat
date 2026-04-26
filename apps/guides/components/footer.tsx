import { assertDefined } from 'guides-app/lib/assertDefined';
import { getAllCategories } from 'guides-app/lib/categories';
import { footerConfig, siteConfig } from 'guides-app/lib/config';
import { Backpack, Globe } from 'lucide-react';
import Link from 'next/link';

export default function Footer() {
  const categories = getAllCategories();

  const company = footerConfig.mainSections[1];
  assertDefined(company);

  return (
    <footer className="border-t py-16 bg-apple-gray-light dark:bg-gray-900/20">
      <div className="container grid gap-10 md:grid-cols-3">
        <div>
          <Link href="/" className="flex items-center gap-2 font-medium">
            <Backpack className="h-5 w-5 text-apple-blue" />
            <span className="text-lg font-semibold">{siteConfig.name}</span>
          </Link>
          <p className="mt-4 text-sm text-muted-foreground">{siteConfig.description}</p>
          <div className="mt-6 flex space-x-5">
            <Link
              href={siteConfig.links.twitter}
              className="text-gray-500 hover:text-apple-blue transition-colors"
              aria-label="Visit PackRat on Twitter"
            >
              <Globe className="h-5 w-5" aria-hidden="true" />
            </Link>
            <Link
              href={siteConfig.links.instagram}
              className="text-gray-500 hover:text-apple-blue transition-colors"
              aria-label="Visit PackRat on Instagram"
            >
              <Globe className="h-5 w-5" aria-hidden="true" />
            </Link>
            <Link
              href={siteConfig.links.facebook}
              className="text-gray-500 hover:text-apple-blue transition-colors"
              aria-label="Visit PackRat on Facebook"
            >
              <Globe className="h-5 w-5" aria-hidden="true" />
            </Link>
            <Link
              href={siteConfig.links.github}
              className="text-gray-500 hover:text-apple-blue transition-colors"
              aria-label="Visit PackRat on GitHub"
            >
              <Globe className="h-5 w-5" aria-hidden="true" />
            </Link>
          </div>
        </div>

        <div>
          <h3 className="mb-4 text-sm font-semibold">Guides</h3>
          <ul className="space-y-3 text-sm">
            {categories.slice(0, 6).map((category) => (
              <li key={category}>
                <Link
                  href={`/?category=${category}`}
                  className="text-gray-500 hover:text-apple-blue transition-colors"
                >
                  {category.charAt(0).toUpperCase() + category.slice(1)}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="mb-4 text-sm font-semibold">Company</h3>
          <ul className="space-y-3 text-sm">
            {company.links.map((link) => (
              <li key={link.title}>
                <Link
                  href={link.href}
                  className="text-gray-500 hover:text-apple-blue transition-colors"
                >
                  {link.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="container mt-12 border-t border-gray-200 dark:border-gray-800 pt-8 text-center text-sm text-gray-500">
        <p>
          © {new Date().getFullYear()} {siteConfig.name}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
