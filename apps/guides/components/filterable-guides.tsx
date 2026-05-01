'use client';

import { Button } from '@packrat/web-ui/components/button';
import CategoryFilter from 'guides-app/components/category-filter';
import GuideCard from 'guides-app/components/guide-card';
import type { Post } from 'guides-app/lib/types';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

interface Props {
  allPosts: Post[];
  categories: string[];
}

function FilterableContent({ allPosts, categories }: Props) {
  const searchParams = useSearchParams() ?? new URLSearchParams();
  const category = searchParams.get('category');
  const search = searchParams.get('search');

  let filteredPosts = allPosts;
  if (category) {
    filteredPosts = allPosts.filter((post) => post.categories?.includes(category));
  } else if (search) {
    const q = search.toLowerCase();
    filteredPosts = allPosts.filter((post) =>
      `${post.title} ${post.description} ${post.categories?.join(' ')}`.toLowerCase().includes(q),
    );
  }

  let pageTitle = 'All Guides';
  if (search) {
    pageTitle = `Search Results for "${search}"`;
  } else if (category) {
    pageTitle = `${category.charAt(0).toUpperCase() + category.slice(1)} Guides`;
  }

  return (
    <section id="guides" className="py-20">
      <div className="container">
        <h2 className="mb-10 text-3xl font-semibold tracking-tight text-center">{pageTitle}</h2>

        <Suspense>
          <CategoryFilter categories={categories} />
        </Suspense>

        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredPosts.length > 0 ? (
            filteredPosts.map((post) => <GuideCard key={post.slug} post={post} />)
          ) : (
            <div className="col-span-3 text-center py-12">
              <p className="text-muted-foreground">
                No guides found. Try a different search or category.
              </p>
              <Button asChild variant="outline" className="mt-4 rounded-full">
                <Link href="/">View all guides</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default function FilterableGuides({ allPosts, categories }: Props) {
  return (
    <Suspense>
      <FilterableContent allPosts={allPosts} categories={categories} />
    </Suspense>
  );
}
