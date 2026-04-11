import { Button } from 'landing-app/components/ui/button';
import { Check } from 'lucide-react';
import Link from 'next/link';

export const metadata = {
  title: 'Pricing | PackRat',
  description: 'PackRat is 100% free — no subscriptions, no hidden fees, no ads.',
};

const features = [
  'Unlimited trips',
  'AI-powered packing lists',
  'Trail maps & offline GPS navigation',
  'Real-time weather integration',
  'Trail recommendations',
  'Health app sync',
  'Community guides',
  'App Store & Google Play access',
];

export default function PricingPage() {
  return (
    <div className="container max-w-2xl py-12 px-4 md:px-6">
      <div className="space-y-16">
        {/* Header */}
        <div className="space-y-4 text-center">
          <h1 className="text-4xl font-extrabold tracking-tight md:text-5xl">
            100% Free. No Catch.
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            No subscriptions, no in-app purchases, no ads. Every feature is available to every user,
            forever.
          </p>
        </div>

        {/* Single plan card */}
        <div className="relative rounded-2xl border border-primary bg-primary/5 shadow-lg shadow-primary/10 p-8 space-y-6">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <span className="bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">
              Everything Included
            </span>
          </div>
          <div className="space-y-2 text-center">
            <h2 className="text-xl font-bold">PackRat</h2>
            <div className="flex items-baseline gap-1 justify-center">
              <span className="text-4xl font-extrabold">$0</span>
              <span className="text-muted-foreground text-sm">/ forever</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Everything you need to plan, pack, and explore.
            </p>
          </div>

          <ul className="space-y-3">
            {features.map((feature) => (
              <li key={feature} className="flex items-start gap-2">
                <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <span className="text-sm">{feature}</span>
              </li>
            ))}
          </ul>

          <Button asChild size="lg" className="w-full">
            <Link href="/#download">Download Free</Link>
          </Button>
        </div>

        {/* FAQ teaser */}
        <section className="space-y-4 text-center">
          <h2 className="text-xl font-semibold">Have questions?</h2>
          <p className="text-muted-foreground">
            Check out our{' '}
            <Link href="/#faq" className="text-primary font-medium hover:underline">
              FAQ section
            </Link>{' '}
            or{' '}
            <Link
              href="mailto:hello@packratai.com"
              className="text-primary font-medium hover:underline"
            >
              contact us
            </Link>{' '}
            — we&apos;re happy to help.
          </p>
        </section>
      </div>
    </div>
  );
}
