import { getAllPosts } from './mdx-static';

export function getAllCategories(): string[] {
  const posts = getAllPosts();

  const categories = new Set<string>();

  for (const post of posts) {
    for (const category of post.categories ?? []) {
      categories.add(category);
    }
  }

  return Array.from(categories).sort();
}
