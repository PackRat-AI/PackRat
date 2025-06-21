"use client";

import CategoryFilter from "@/components/category-filter";
import FeaturedGuides from "@/components/featured-guides";
import GuideCard from "@/components/guide-card";
import { Button } from "@/components/ui/button";
import { getAllCategories } from "@/lib/categories";
import { featuresConfig } from "@/lib/config";
import { getAllPosts } from "@/lib/mdx-static";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function HomeContent() {
  const searchParams = useSearchParams();
  const category = searchParams.get("category");
  const search = searchParams.get("search");

  const allPosts = getAllPosts();
  const categories = getAllCategories();

  // Filter posts by category if provided
  let filteredPosts = allPosts;

  if (category) {
    filteredPosts = allPosts.filter((post) => post.categories?.includes(category as string));
  } else if (search) {
    const searchQuery = search.toLowerCase();
    filteredPosts = allPosts.filter((post) => {
      const searchContent = `${post.title} ${
        post.description
      } ${post.categories?.join(" ")}`.toLowerCase();
      return searchContent.includes(searchQuery);
    });
  }

  // Get featured guides (most recent 3)
  const featuredGuides = allPosts.slice(0, 3);

  // Determine the page title based on search params
  let pageTitle = "All Guides";
  if (search) {
    pageTitle = `Search Results for "${search}"`;
  } else if (category) {
    pageTitle = `${category.charAt(0).toUpperCase() + category.slice(1)} Guides`;
  }

  return (
    <div>
      {/* Hero Section - Apple style */}
      <section className="relative py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-50 to-white dark:from-blue-950/20 dark:to-background"></div>
        <div className="container relative text-center">
          <h1 className="mb-4 text-5xl font-semibold tracking-tight sm:text-6xl md:text-7xl bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400">
            PackRat Guides
          </h1>
          <p className="mx-auto mb-8 max-w-2xl text-xl text-gray-600 dark:text-gray-300 font-medium">
            Expert advice for your next outdoor adventure
          </p>
          <Button
            asChild
            size="lg"
            className="rounded-full bg-apple-blue hover:bg-apple-blue/90 text-white px-8 h-12"
          >
            <Link href="#guides">Explore Guides</Link>
          </Button>
        </div>
      </section>

      {/* Features Section - Apple style */}
      {!category && !search && (
        <>
          <section className="py-20">
            <div className="container">
              <div className="grid gap-10 md:grid-cols-3">
                {featuresConfig.map((feature, index) => (
                  <div key={index} className="flex flex-col items-center text-center">
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

          {/* Featured Guides - Apple style */}
          <section className="py-20 bg-apple-gray-light dark:bg-gray-900/20">
            <div className="container">
              <h2 className="mb-10 text-3xl font-semibold tracking-tight text-center">
                Featured Guides
              </h2>
              <FeaturedGuides guides={featuredGuides} />
            </div>
          </section>
        </>
      )}

      {/* All Guides - Apple style */}
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
    </div>
  );
}

export default function Home() {
  return (
    <Suspense>
      <HomeContent />
    </Suspense>
  );
}
