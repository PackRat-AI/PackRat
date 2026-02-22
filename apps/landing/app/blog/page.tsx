import Link from 'next/link';

export const metadata = {
  title: 'Blog | PackRat',
  description:
    'Stay updated with the latest outdoor adventure tips, gear reviews, and trail guides.',
};

const blogPosts = [
  {
    id: 1,
    title: '10 Essential Items Every Backpacker Needs',
    excerpt: 'Discover the must-have gear that can make or break your next outdoor adventure.',
    date: 'January 15, 2026',
    category: 'Gear Guide',
  },
  {
    id: 2,
    title: 'Best Hiking Trails for Beginners in 2026',
    excerpt: 'Start your hiking journey with these beginner-friendly trails across the country.',
    date: 'January 10, 2026',
    category: 'Trail Guide',
  },
  {
    id: 3,
    title: 'How to Pack Light for Multi-Day Trips',
    excerpt: 'Master the art of minimalist packing without sacrificing comfort or safety.',
    date: 'January 5, 2026',
    category: 'Tips & Tricks',
  },
  {
    id: 4,
    title: 'Winter Camping: A Complete Guide',
    excerpt: 'Everything you need to know about camping in cold weather conditions.',
    date: 'December 28, 2025',
    category: 'Seasonal Guide',
  },
  {
    id: 5,
    title: 'Leave No Trace Principles Explained',
    excerpt: 'Learn how to minimize your environmental impact while enjoying the outdoors.',
    date: 'December 20, 2025',
    category: 'Conservation',
  },
];

export default function BlogPage() {
  return (
    <div className="container max-w-4xl py-12 px-4 md:px-6">
      <div className="space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">PackRat Blog</h1>
          <p className="text-muted-foreground">
            Adventure tips, gear reviews, and trail inspiration
          </p>
        </div>

        <div className="grid gap-6">
          {blogPosts.map((post) => (
            <article
              key={post.id}
              className="group relative rounded-lg border p-6 hover:bg-muted/50 transition-colors"
            >
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                    {post.category}
                  </span>
                  <span>•</span>
                  <time>{post.date}</time>
                </div>
                <h2 className="text-xl font-semibold tracking-tight group-hover:text-primary transition-colors">
                  <Link href={`#`} className="absolute inset-0">
                    <span className="sr-only">View {post.title}</span>
                  </Link>
                  {post.title}
                </h2>
                <p className="text-muted-foreground">{post.excerpt}</p>
              </div>
            </article>
          ))}
        </div>

        <div className="flex justify-center pt-8">
          <p className="text-sm text-muted-foreground">
            More articles coming soon. Subscribe to our newsletter for updates.
          </p>
        </div>
      </div>
    </div>
  );
}
