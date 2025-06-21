import { getAllPosts } from "./mdx-static";

export function getAllCategories(): string[] {
  const posts = getAllPosts();

  const categories = new Set<string>();

  posts.forEach((post) => {
    post.categories?.forEach((category) => {
      categories.add(category);
    });
  });

  return Array.from(categories).sort();
}
