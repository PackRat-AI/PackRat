// This is a browser-compatible version of your MDX utilities
import { postContent, posts } from "./content";
import type { Post } from "./types";

export function getAllPosts(): Post[] {
  return posts;
}

export function getPostBySlug(slug: string): Post | null {
  return posts.find((p) => p.slug === slug) || null;
}

export function getMdxContent(slug: string): string {
  return postContent[slug] || `<p>Content not found for ${slug}</p>`;
}

export function getRelatedPosts(post: Post, count = 3): Post[] {
  // Filter out the current post
  const otherPosts = posts.filter((p) => p.slug !== post.slug);

  // Find posts with matching categories
  const relatedByCategory = otherPosts.filter((p) =>
    p.categories?.some((category) => post.categories?.includes(category)),
  );

  // Sort by number of matching categories
  relatedByCategory.sort((a, b) => {
    const aMatches =
      a.categories?.filter((category) => post.categories?.includes(category)).length || 0;
    const bMatches =
      b.categories?.filter((category) => post.categories?.includes(category)).length || 0;
    return bMatches - aMatches;
  });

  // Return the top related posts, or recent posts if not enough related
  if (relatedByCategory.length >= count) {
    return relatedByCategory.slice(0, count);
  } else {
    // Fill remaining slots with recent posts
    const recentPosts = otherPosts
      .filter((p) => !relatedByCategory.includes(p))
      .slice(0, count - relatedByCategory.length);

    return [...relatedByCategory, ...recentPosts];
  }
}
