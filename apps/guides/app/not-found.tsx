import { Button } from '@packrat/web-ui/components/button';
import { Compass, Home } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Page not found',
  description:
    "We couldn't find the guide you were looking for. Head back to all PackRat guides or explore a different topic.",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="container flex flex-1 items-center justify-center px-4 py-24">
      <div className="mx-auto max-w-xl text-center">
        <p className="text-sm font-medium uppercase tracking-widest text-apple-blue">404</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">Page not found</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          The guide you were looking for may have been moved, renamed, or never existed. Try heading
          back to all guides or browsing by category.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link href="/">
              <Home className="mr-2 h-4 w-4" aria-hidden="true" />
              Return to all guides
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/?category=gear">
              <Compass className="mr-2 h-4 w-4" aria-hidden="true" />
              Browse by category
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
