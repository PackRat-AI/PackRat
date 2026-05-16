import { Button } from '@packrat/web-ui/components/button';
import FeaturedGuides from 'guides-app/components/featured-guides';
import FilterableGuides from 'guides-app/components/filterable-guides';
import { getAllCategories } from 'guides-app/lib/categories';
import { featuresConfig } from 'guides-app/lib/config';
import { getAllPosts } from 'guides-app/lib/mdx-static';
import Link from 'next/link';

export default function Home() {
  const allPosts = getAllPosts();
  const categories = getAllCategories();
  const featuredGuides = allPosts.slice(0, 3);

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

      {/* Features Section — server-rendered */}
      <section className="py-20">
        <div className="container">
          <div className="grid gap-10 md:grid-cols-3">
            {featuresConfig.map((feature) => (
              <div key={feature.title} className="flex flex-col items-center text-center">
                <div className={`mb-6 rounded-full p-5 ${feature.iconBgClass}`}>
                  <feature.icon className={`h-8 w-8 ${feature.iconClass}`} />
                </div>
                <h3 className="mb-3 text-xl font-semibold">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Guides — server-rendered */}
      <section className="py-20 bg-apple-gray-light dark:bg-gray-900/20">
        <div className="container">
          <h2 className="mb-10 text-3xl font-semibold tracking-tight text-center">
            Featured Guides
          </h2>
          <FeaturedGuides guides={featuredGuides} />
        </div>
      </section>

      {/* Filterable guides grid — client component for search/filter UI only */}
      <FilterableGuides allPosts={allPosts} categories={categories} />
    </div>
  );
}
