import { Card, CardContent } from 'landing-app/components/ui/card';
import { Backpack, Compass, Heart, Shield, Users, Zap } from 'lucide-react';
import Link from 'next/link';

export const metadata = {
  title: 'About Us | PackRat',
  description:
    'Learn about PackRat - the ultimate packing companion app for travelers and outdoor enthusiasts.',
};

export default function AboutPage() {
  const features = [
    {
      id: 'smart-lists',
      icon: Backpack,
      title: 'Smart Packing Lists',
      description:
        'Create intelligent packing lists tailored to your trip type, duration, and destination.',
    },
    {
      id: 'trip-planning',
      icon: Compass,
      title: 'Trip Planning',
      description: 'Plan every detail of your adventure with weather-integrated recommendations.',
    },
    {
      id: 'never-forget',
      icon: Shield,
      title: 'Never Forget',
      description: 'Ensure you never leave essential items behind with smart reminders.',
    },
    {
      id: 'community',
      icon: Users,
      title: 'Community Driven',
      description: 'Join a community of travelers sharing packing tips and recommendations.',
    },
    {
      id: 'fast',
      icon: Zap,
      title: 'Lightning Fast',
      description: 'Generate complete packing lists in seconds, not minutes.',
    },
    {
      id: 'privacy',
      icon: Heart,
      title: 'Privacy First',
      description: 'Your trip data stays private and secure. We never sell your information.',
    },
  ];

  return (
    <div className="container max-w-5xl py-12 px-4 md:px-6">
      <div className="space-y-12">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tight">About PackRat</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Your trusted companion for stress-free travel preparation
          </p>
        </div>

        <section className="space-y-6">
          <div className="prose prose-lg max-w-none">
            <p className="text-lg leading-relaxed">
              PackRat was born from a simple observation: travelers and outdoor enthusiasts
              constantly struggle with forgetting essential items. Whether it&apos;s a camping trip,
              international vacation, or weekend getaway, the stress of packing often overshadows
              the excitement of the journey ahead.
            </p>
            <p className="text-lg leading-relaxed">
              We set out to build more than just a packing list app. PackRat is your intelligent
              travel companion that learns your preferences, adapts to your destinations, and
              ensures you&apos;re always prepared for whatever adventure awaits.
            </p>
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-3xl font-bold tracking-tight text-center">Our Mission</h2>
          <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
            <CardContent className="p-8">
              <p className="text-xl text-center leading-relaxed">
                To empower travelers and adventurers worldwide with smart, intuitive tools that
                transform packing from a chore into a seamless part of the journey.
              </p>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-8">
          <h2 className="text-3xl font-bold tracking-tight text-center">What Makes Us Different</h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <Card key={feature.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6 space-y-3">
                  <feature.icon className="h-8 w-8 text-primary" />
                  <h3 className="text-xl font-semibold">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-3xl font-bold tracking-tight text-center">Our Story</h2>
          <div className="space-y-4 text-lg leading-relaxed">
            <p>
              Founded in 2024, PackRat started as a side project by a group of outdoor enthusiasts
              who were tired of arriving at campsites missing crucial gear. What began as a simple
              checklist app quickly evolved into a comprehensive travel preparation platform.
            </p>
            <p>
              Today, PackRat serves thousands of users across the globe, from weekend hikers to
              digital nomads. Our team is passionate about creating technology that enhances real
              experiences and helps people focus on what matters most - enjoying their adventures.
            </p>
          </div>
        </section>

        <section className="text-center space-y-6 py-8">
          <h2 className="text-3xl font-bold tracking-tight">Ready to Pack Smarter?</h2>
          <p className="text-lg text-muted-foreground">
            Join thousands of travelers who never forget the essentials.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/download"
              className="inline-flex items-center justify-center rounded-md bg-primary px-8 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Download the App
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center rounded-md border border-input bg-background px-8 py-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              Get in Touch
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
