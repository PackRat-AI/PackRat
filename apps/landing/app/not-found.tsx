import { Button } from '@packrat/web-ui/components/button';
import { Compass, Home } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Page not found',
  description:
    "We couldn't find that page on PackRat. Head back home or explore what PackRat can do for your next outdoor adventure.",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-24">
      <div className="mx-auto max-w-xl text-center">
        <p className="text-sm font-medium uppercase tracking-widest text-primary">404</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">Page not found</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          The page you're looking for doesn't exist or has been moved. Let's get you back on trail.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link href="/">
              <Home className="mr-2 h-4 w-4" aria-hidden="true" />
              Back to home
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/about">
              <Compass className="mr-2 h-4 w-4" aria-hidden="true" />
              Learn about PackRat
            </Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
