import { Button } from 'landing-app/components/ui/button';
import { Backpack, Heart, Mountain, Users } from 'lucide-react';
import Link from 'next/link';

export const metadata = {
  title: 'About | PackRat',
  description: 'Learn about PackRat — the team behind your ultimate outdoor adventure companion.',
};

const values = [
  {
    icon: Mountain,
    title: 'Adventure First',
    description:
      'Everything we build is designed to get you outside more confidently, with less stress and better preparation.',
  },
  {
    icon: Users,
    title: 'Community Driven',
    description:
      'We listen to our community of outdoor enthusiasts and build features that solve real problems on the trail.',
  },
  {
    icon: Heart,
    title: 'Safety Focused',
    description:
      'We believe preparedness saves lives. Our tools help you plan smarter so every adventure ends safely.',
  },
];

export default function AboutPage() {
  return (
    <div className="container max-w-4xl py-12 px-4 md:px-6">
      <div className="space-y-16">
        {/* Hero */}
        <div className="space-y-6 text-center">
          <div className="flex justify-center">
            <Backpack className="h-12 w-12 text-primary" />
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight md:text-5xl">About PackRat</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            We&apos;re a team of outdoor enthusiasts on a mission to make every adventure safer,
            more organized, and more enjoyable — completely free.
          </p>
        </div>

        {/* Origin Story */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">Where It Started</h2>
          <p className="text-muted-foreground leading-relaxed">
            PackRat was born out of a familiar frustration: standing at the trailhead realising
            you&apos;ve forgotten your rain jacket, your headlamp, or (worse) your water filter.
            After one too many trips cut short or made miserable by missing gear, our founder set
            out to build the app they always wished existed.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            The vision was simple — an intelligent packing assistant that knows your trip, the
            forecast, and your gear, and builds a personalised list so you carry exactly what you
            need and nothing you don&apos;t. No more overpacking. No more forgetting essentials.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            What started as a side project quickly grew into something the outdoor community truly
            needed. Today, PackRat is used by thousands of hikers, backpackers, trail runners, and
            weekend campers across the globe — and it&apos;s completely free.
          </p>
        </section>

        {/* Mission */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">Our Mission</h2>
          <p className="text-muted-foreground leading-relaxed">
            Our mission is straightforward: help more people get outside with confidence. Whether
            you&apos;re heading out for an afternoon day hike or a week-long backcountry expedition,
            PackRat has you covered. We believe the barrier to outdoor adventure should be as low as
            possible — which is why PackRat is, and always will be, free to use.
          </p>
        </section>

        {/* Values */}
        <section className="space-y-8">
          <h2 className="text-2xl font-semibold tracking-tight">Our Values</h2>
          <div className="grid gap-6 md:grid-cols-3">
            {values.map((value) => {
              const Icon = value.icon;
              return (
                <div
                  key={value.title}
                  className="space-y-3 p-6 rounded-xl border border-border bg-card/50"
                >
                  <Icon className="h-8 w-8 text-primary" />
                  <h3 className="text-lg font-semibold">{value.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {value.description}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Careers */}
        {/* biome-ignore lint/nursery/useUniqueElementIds: anchor target for footer link */}
        <section id="careers" className="space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">Careers</h2>
          <p className="text-muted-foreground leading-relaxed">
            We&apos;re always looking for passionate people who love the outdoors and great
            software. If you want to help us build the future of adventure planning, we&apos;d love
            to hear from you.
          </p>
          <p className="text-muted-foreground">
            Send your resume and a note about your favorite trail to{' '}
            <Link
              href="mailto:careers@packratai.com"
              className="text-primary font-medium hover:underline"
            >
              careers@packratai.com
            </Link>
          </p>
        </section>

        {/* CTA */}
        <div className="text-center space-y-4 pt-4">
          <p className="text-muted-foreground">Ready to hit the trails?</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg">
              <Link href="/#download">Download Free</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="mailto:hello@packratai.com">Contact Us</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
