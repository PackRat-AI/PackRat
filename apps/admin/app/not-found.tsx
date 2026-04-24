import { Backpack } from 'lucide-react';
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center px-4">
        <div className="flex justify-center mb-6">
          <div className="bg-primary/10 rounded-full p-6 inline-flex">
            <Backpack className="w-12 h-12 text-primary" />
          </div>
        </div>
        <h1 className="text-8xl font-extrabold text-foreground mb-2 leading-none">404</h1>
        <p className="text-xl font-semibold text-foreground mb-2">Page not found</p>
        <p className="text-muted-foreground max-w-xs mx-auto mb-8">
          This admin page doesn&apos;t exist. Head back to the dashboard.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
