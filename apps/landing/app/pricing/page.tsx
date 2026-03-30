import { Button } from 'landing-app/components/ui/button';
import { Check } from 'lucide-react';
import Link from 'next/link';

export const metadata = {
  title: 'Pricing | PackRat',
  description: 'Simple, transparent pricing for every type of adventurer. Get started for free.',
};

const plans = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    description: 'Perfect for casual hikers and first-time adventurers.',
    features: [
      'Up to 3 active trips',
      'Basic packing lists',
      'Trail maps (online)',
      'Community guides',
      'App Store & Google Play access',
    ],
    cta: { text: 'Download Free', href: '/#download' },
    highlighted: false,
  },
  {
    name: 'Premium',
    price: '$4.99',
    period: 'per month',
    annualNote: 'or $39.99/year — save 33%',
    description: 'For serious outdoor enthusiasts who want the full PackRat experience.',
    features: [
      'Unlimited trips',
      'Smart packing lists with weather sync',
      'Offline maps & GPS navigation',
      'Real-time weather integration',
      'Trail recommendations',
      'Health app sync',
      'Priority support',
      '7-day free trial',
    ],
    cta: { text: 'Start Free Trial', href: '/#download' },
    highlighted: true,
  },
];

export default function PricingPage() {
  return (
    <div className="container max-w-4xl py-12 px-4 md:px-6">
      <div className="space-y-16">
        {/* Header */}
        <div className="space-y-4 text-center">
          <h1 className="text-4xl font-extrabold tracking-tight md:text-5xl">
            Simple, Transparent Pricing
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Start for free and upgrade when you&apos;re ready to unlock the full adventure
            experience.
          </p>
        </div>

        {/* Plans */}
        <div className="grid gap-8 md:grid-cols-2">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-2xl border p-8 space-y-6 ${
                plan.highlighted
                  ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10'
                  : 'border-border bg-card/50'
              }`}
            >
              {plan.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">
                    Most Popular
                  </span>
                </div>
              )}
              <div className="space-y-2">
                <h2 className="text-xl font-bold">{plan.name}</h2>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold">{plan.price}</span>
                  <span className="text-muted-foreground text-sm">/ {plan.period}</span>
                </div>
                {plan.annualNote && (
                  <p className="text-sm text-primary font-medium">{plan.annualNote}</p>
                )}
                <p className="text-sm text-muted-foreground">{plan.description}</p>
              </div>

              <ul className="space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                asChild
                size="lg"
                className="w-full"
                variant={plan.highlighted ? 'default' : 'outline'}
              >
                <Link href={plan.cta.href}>{plan.cta.text}</Link>
              </Button>
            </div>
          ))}
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
