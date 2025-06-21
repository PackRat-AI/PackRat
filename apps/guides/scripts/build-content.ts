// This script would run BEFORE next build
// It processes your MDX files and outputs JSON that can be imported
// in your static site

import { Post } from '@/lib/types';

import fs from 'fs';
import matter from 'gray-matter';
import path from 'path';
import remarkHtml from 'remark-html';
import markdown from 'remark-parse';
import { unified } from 'unified';

const postsDirectory = path.join(process.cwd(), 'content/posts');
const outputFile = path.join(process.cwd(), 'lib/content.ts');

async function buildContent() {
  console.log('Building content...');

  // Get all posts
  const filenames = fs.readdirSync(postsDirectory);
  const posts = filenames
    .filter((filename: string) => filename.endsWith('.mdx'))
    .map((filename: string) => {
      const filePath = path.join(postsDirectory, filename);
      const fileContents = fs.readFileSync(filePath, 'utf8');
      const { data, content } = matter(fileContents);

      return {
        slug: filename.replace(/\.mdx$/, ''),
        title: data.title,
        description: data.description,
        date: data.date,
        categories: data.categories || [],
        author: data.author,
        readingTime: data.readingTime,
        difficulty: data.difficulty,
        ...(data.coverImage && { coverImage: data.coverImage }),
        content, // Include the raw content
      };
    })
    .sort((a: Post, b: Post) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Process each post's content to HTML
  const postContent: Record<string, string> = {};
  for (const post of posts) {
    const processedContent = await unified().use(markdown).use(remarkHtml).process(post.content);

    postContent[post.slug] = processedContent.toString();
  }

  // Extract categories
  const categories = [...new Set(posts.flatMap((post: Post) => post.categories || []))];

  // Generate the content file
  const contentFile = `// This file is auto-generated. Do not edit manually.
import type { Post } from "./types";

export const posts: Post[] = ${JSON.stringify(posts, null, 2)};

export const postContent: Record<string, string> = ${JSON.stringify(postContent, null, 2)};

export const categories: string[] = ${JSON.stringify(categories, null, 2)};
`;

  fs.writeFileSync(outputFile, contentFile);

  console.log(`Built ${posts.length} posts and ${categories.length} categories`);
}

buildContent().catch(console.error);
