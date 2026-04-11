import { Button } from 'landing-app/components/ui/button';
import { ArrowRight, BookOpen, MapPin, PackageOpen } from 'lucide-react';
import Link from 'next/link';

export const metadata = {
  title: 'Blog | PackRat',
  description:
    'Tips, guides, and stories for outdoor adventurers. Explore hiking tips, gear reviews, and trail guides from the PackRat team.',
};

const categories = [
  {
    icon: MapPin,
    title: 'Trail Guides',
    description:
      'In-depth guides for popular trails and hidden gems across North America and beyond.',
    href: 'https://guides.packratai.com/',
  },
  {
    icon: PackageOpen,
    title: 'Gear & Packing',
    description:
      'Expert advice on choosing the right gear, packing efficiently, and staying light on the trail.',
    href: 'https://guides.packratai.com/',
  },
  {
    icon: BookOpen,
    title: 'Adventure Tips',
    description:
      'Safety tips, navigation skills, wilderness survival, and everything else you need to adventure confidently.',
    href: 'https://guides.packratai.com/',
  },
];

export default function BlogPage() {
  return (
    <div className="container max-w-4xl py-12 px-4 md:px-6">
      <div className="space-y-16">
        {/* Header */}
        <div className="space-y-4">
          <h1 className="text-4xl font-extrabold tracking-tight md:text-5xl">Blog</h1>
          <p className="text-xl text-muted-foreground max-w-2xl">
            Tips, guides, and stories for outdoor adventurers. Written by our team and community of
            trail-tested explorers.
          </p>
        </div>

        {/* Featured: Guides site */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold tracking-tight">Explore Our Guides</h2>
          <p className="text-muted-foreground">
            Our full library of outdoor guides — covering trails, gear, safety, and more — lives on
            the PackRat Guides site.
          </p>
          <div className="grid gap-6 md:grid-cols-3">
            {categories.map((cat) => {
              const Icon = cat.icon;
              return (
                <Link
                  key={cat.title}
                  href={cat.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group space-y-3 p-6 rounded-xl border border-border bg-card/50 hover:border-primary/50 transition-colors"
                >
                  <Icon className="h-8 w-8 text-primary" />
                  <h3 className="text-lg font-semibold group-hover:text-primary transition-colors">
                    {cat.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{cat.description}</p>
                  <div className="flex items-center text-sm text-primary font-medium">
                    Read more{' '}
                    <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </div>
                </Link>
              );
            })}
          </div>
          <div className="pt-2">
            <Button asChild size="lg">
              <Link href="https://guides.packratai.com/" target="_blank" rel="noopener noreferrer">
                Visit the Guides Site
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </section>

        {/* Newsletter / Stay Updated */}
        <section className="space-y-4 rounded-xl border border-border bg-card/50 p-6 md:p-8">
          <h2 className="text-xl font-semibold">Stay in the loop</h2>
          <p className="text-muted-foreground">
            Follow us on social media or contact us to get the latest PackRat news, trail guides,
            and adventure inspiration delivered to you.
          </p>
          <Button asChild variant="outline">
            <Link href="mailto:hello@packratai.com">Contact Us</Link>
          </Button>
        </section>
      </div>
    </div>
  );
}
