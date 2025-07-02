'use client';

import { useQuery } from '@tanstack/react-query';
import { getAllCategories } from 'guides-app/lib/categories';
import { footerConfig, siteConfig } from 'guides-app/lib/config';
import { Backpack, Facebook, Github, Instagram, Twitter } from 'lucide-react';
import Link from 'next/link';

export default function Footer() {
  // Fetch categories using TanStack Query
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: getAllCategories,
  });

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
            >
              <Twitter className="h-5 w-5" />
              <span className="sr-only">Twitter</span>
            </Link>
            <Link
              href={siteConfig.links.instagram}
              className="text-gray-500 hover:text-apple-blue transition-colors"
            >
              <Instagram className="h-5 w-5" />
              <span className="sr-only">Instagram</span>
            </Link>
            <Link
              href={siteConfig.links.facebook}
              className="text-gray-500 hover:text-apple-blue transition-colors"
            >
              <Facebook className="h-5 w-5" />
              <span className="sr-only">Facebook</span>
            </Link>
            <Link
              href={siteConfig.links.github}
              className="text-gray-500 hover:text-apple-blue transition-colors"
            >
              <Github className="h-5 w-5" />
              <span className="sr-only">GitHub</span>
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
            {footerConfig.mainSections[1].links.map((link, index) => (
              <li key={index}>
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
