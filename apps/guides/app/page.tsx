import { Button } from '@packrat/web-ui/components/button';
import GuidesContent from 'guides-app/components/guides-content';
import Link from 'next/link';
import { Suspense } from 'react';

export default function Home() {
  return (
    <div>
      {/* Hero Section — server-rendered for fast LCP */}
      <section className="relative py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-50 to-white dark:from-blue-950/20 dark:to-background" />
        <div className="container relative text-center">
          <h1 className="mb-4 text-5xl font-semibold tracking-tight sm:text-6xl md:text-7xl bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400">
            PackRat Guides
          </h1>
          <p className="mx-auto mb-8 max-w-2xl text-xl text-gray-600 dark:text-gray-300 font-medium">
            Expert advice for your next outdoor adventure
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              asChild
              size="lg"
              className="rounded-full bg-apple-blue hover:bg-apple-blue/90 text-white px-8 h-12"
            >
              <Link href="#guides">Explore Guides</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="rounded-full px-8 h-12">
              <Link href="https://packratai.com/#download">Download Free App</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Dynamic content — rendered client-side (uses useSearchParams) */}
      <Suspense>
        <GuidesContent />
      </Suspense>
    </div>
  );
}
