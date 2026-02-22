import { Badge } from 'landing-app/components/ui/badge';
import { Card, CardContent, CardHeader } from 'landing-app/components/ui/card';
import { Calendar, Clock, User } from 'lucide-react';
import Link from 'next/link';

export const metadata = {
  title: 'Blog | PackRat',
  description: 'Travel tips, packing guides, and adventure stories from the PackRat community.',
};

export default function BlogPage() {
  const featuredPosts = [
    {
      slug: 'camping-checklist',
      title: 'The Ultimate Camping Packing Checklist',
      excerpt:
        'Everything you need for a perfect weekend in the wilderness, from essential gear to comfort items.',
      category: 'Camping',
      author: 'Sarah Mitchell',
      date: 'Jan 15, 2025',
      readTime: '8 min read',
      featured: true,
    },
    {
      slug: 'minimalist-travel',
      title: 'Minimalist Travel: How to Pack for 2 Weeks in a Carry-On',
      excerpt: 'Master the art of packing light with our comprehensive guide to minimalist travel.',
      category: 'Travel Tips',
      author: 'James Chen',
      date: 'Jan 12, 2025',
      readTime: '6 min read',
      featured: true,
    },
    {
      slug: 'winter-essentials',
      title: 'Winter Adventure Essentials',
      excerpt:
        'Stay warm and safe on your cold-weather adventures with our expert gear recommendations.',
      category: 'Gear Guide',
      author: 'Emma Rodriguez',
      date: 'Jan 8, 2025',
      readTime: '5 min read',
      featured: false,
    },
  ];

  const recentPosts = [
    {
      slug: 'beach-must-haves',
      title: '10 Beach Vacation Must-Haves',
      excerpt: 'From sun protection to entertainment, what to pack for the perfect beach getaway.',
      category: 'Beach',
      author: 'Lisa Park',
      date: 'Jan 5, 2025',
      readTime: '4 min read',
    },
    {
      slug: 'business-travel',
      title: 'Packing for Business Travel',
      excerpt: 'Look professional while traveling light with our business travel packing tips.',
      category: 'Business',
      author: 'Michael Torres',
      date: 'Jan 3, 2025',
      readTime: '5 min read',
    },
    {
      slug: 'family-road-trip',
      title: 'Family Road Trip Packing Guide',
      excerpt: 'Keep the whole family happy and prepared on your next road adventure.',
      category: 'Family',
      author: 'Jennifer Adams',
      date: 'Dec 28, 2024',
      readTime: '7 min read',
    },
    {
      slug: 'photography-gear',
      title: 'Photography Gear for Travelers',
      excerpt: 'Capture your adventures with the right equipment without overpacking.',
      category: 'Photography',
      author: 'David Kim',
      date: 'Dec 22, 2024',
      readTime: '6 min read',
    },
  ];

  const categories = [
    'All',
    'Camping',
    'Travel Tips',
    'Gear Guide',
    'Beach',
    'Business',
    'Family',
    'Photography',
  ];

  return (
    <div className="container max-w-5xl py-12 px-4 md:px-6">
      <div className="space-y-12">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tight">PackRat Blog</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Travel tips, packing guides, and adventure stories to inspire your next journey
          </p>
        </div>

        <section className="space-y-6">
          <div className="flex flex-wrap gap-2 justify-center">
            {categories.map((category, index) => (
              <Badge
                key={category}
                variant={index === 0 ? 'default' : 'secondary'}
                className="cursor-pointer px-4 py-2 text-sm"
              >
                {category}
              </Badge>
            ))}
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-2xl font-bold tracking-tight">Featured Posts</h2>
          <div className="grid gap-6 md:grid-cols-2">
            {featuredPosts.slice(0, 2).map((post) => (
              <Card key={post.slug} className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="secondary">{post.category}</Badge>
                  </div>
                  <h3 className="text-xl font-bold leading-tight hover:text-primary transition-colors">
                    <Link href={`/blog/${post.slug}`}>{post.title}</Link>
                  </h3>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-muted-foreground">{post.excerpt}</p>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <User className="h-4 w-4" />
                      {post.author}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {post.date}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {post.readTime}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-2xl font-bold tracking-tight">Recent Articles</h2>
          <div className="grid gap-4">
            {[...featuredPosts.slice(2), ...recentPosts].map((post) => (
              <Card key={post.slug} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row md:items-start gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{post.category}</Badge>
                      </div>
                      <h3 className="text-lg font-semibold hover:text-primary transition-colors">
                        <Link href={`/blog/${post.slug}`}>{post.title}</Link>
                      </h3>
                      <p className="text-muted-foreground text-sm">{post.excerpt}</p>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground pt-2">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {post.author}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {post.date}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {post.readTime}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="text-center space-y-4 py-8">
          <p className="text-muted-foreground">
            Want to contribute to our blog?{' '}
            <Link href="/contact" className="text-primary hover:underline font-medium">
              Get in touch
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}
