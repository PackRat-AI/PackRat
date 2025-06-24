import GuideCard from 'guides-app/components/guide-card';
import { Badge } from 'guides-app/components/ui/badge';
import { Button } from 'guides-app/components/ui/button';
import {
  getAllPosts,
  getMdxContent,
  getPostBySlug,
  getRelatedPosts,
} from 'guides-app/lib/mdx-static';
import { format } from 'date-fns';
import { ArrowLeft, Calendar, Clock, MountainSnow, User } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export async function generateStaticParams() {
  const posts = getAllPosts();
  return posts.map((post) => ({
    slug: post.slug,
  }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const post = getPostBySlug(slug);

  if (!post) {
    return {
      title: 'Guide Not Found',
    };
  }

  return {
    title: `${post.title} | PackRat Guides`,
    description: post.description,
  };
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const post = getPostBySlug(slug);

  if (!post) {
    notFound();
  }

  // Get the compiled MDX content
  const content = getMdxContent(slug);

  // Get related posts
  const relatedPosts = getRelatedPosts(post, 3);

  return (
    <div>
      {/* Guide Header - Apple style */}
      <div className="relative py-16 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-50 to-white dark:from-blue-950/20 dark:to-background"></div>
        <div className="container relative">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {post.categories?.map((category) => (
              <Link href={`/?category=${category}`} key={category}>
                <Badge className="rounded-full px-3 py-1 bg-apple-blue hover:bg-apple-blue/90 text-white">
                  {category}
                </Badge>
              </Link>
            ))}
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl text-gray-900 dark:text-white">
            {post.title}
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-gray-600 dark:text-gray-300">
            {post.description}
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-5 text-sm text-gray-500 dark:text-gray-400">
            <div className="flex items-center gap-1.5">
              <User className="h-4 w-4" />
              <span>{post.author || 'PackRat Team'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              <time dateTime={post.date}>{format(new Date(post.date), 'MMMM d, yyyy')}</time>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              <span>{post.readingTime || '5 min read'}</span>
            </div>
            {post.difficulty && (
              <div className="flex items-center gap-1.5">
                <MountainSnow className="h-4 w-4" />
                <span>Difficulty: {post.difficulty}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Guide Content - Apple style */}
      <div className="container py-12 md:py-16">
        <article className="prose prose-slate dark:prose-invert mx-auto max-w-3xl">
          <div dangerouslySetInnerHTML={{ __html: content }} />
        </article>

        <div className="mx-auto mt-16 max-w-3xl">
          <Button variant="outline" asChild className="rounded-full">
            <Link href="/" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Guides
            </Link>
          </Button>

          {relatedPosts.length > 0 && (
            <div className="mt-16">
              <h2 className="mb-8 text-2xl font-semibold text-center">Related Guides</h2>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {relatedPosts.map((post) => (
                  <GuideCard key={post.slug} post={post} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
