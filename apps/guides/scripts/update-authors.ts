#!/usr/bin/env bun
import chalk from 'chalk';
import fs from 'fs';
import matter from 'gray-matter';
import { assertDefined } from 'guides-app/lib/assertDefined';
import path from 'path';

// Configuration
const POSTS_DIR = path.join(process.cwd(), 'content/posts');

// Predefined list of authors (from generate-content.ts)
const AUTHORS = [
  'Alex Morgan',
  'Jamie Rivera',
  'Sam Washington',
  'Taylor Chen',
  'Jordan Smith',
  'Casey Johnson',
] as const;

// Additional authors found in existing content
const ADDITIONAL_AUTHORS = [
  'Dr. Amanda Rivera',
  'Thomas Reynolds',
  'Michael Chen',
  'Marcus Johnson',
  'Alex Thompson',
  'Jordan Williams',
  'Lisa Chen',
  'Sarah Johnson',
  'Jamie Rodriguez',
] as const;

const ALL_AUTHORS = [...AUTHORS, ...ADDITIONAL_AUTHORS] as const;

type ValidAuthor = (typeof ALL_AUTHORS)[number];

interface PostMetadata {
  title: string;
  author: string;
  slug: string;
  filePath: string;
}

// Validate if an author name is in the predefined list
function isValidAuthor(author: string): author is ValidAuthor {
  return ALL_AUTHORS.includes(author as ValidAuthor);
}

// Get all posts with their metadata
function getAllPosts(): PostMetadata[] {
  if (!fs.existsSync(POSTS_DIR)) {
    throw new Error(`Posts directory not found: ${POSTS_DIR}`);
  }

  const files = fs.readdirSync(POSTS_DIR).filter((file) => file.endsWith('.mdx'));
  const posts: PostMetadata[] = [];

  for (const file of files) {
    const filePath = path.join(POSTS_DIR, file);
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const { data } = matter(fileContent);

    posts.push({
      title: data.title || 'Untitled',
      author: data.author || 'Unknown',
      slug: file.replace('.mdx', ''),
      filePath,
    });
  }

  return posts;
}

// Update author in a specific post
function updatePostAuthor(post: PostMetadata, newAuthor: ValidAuthor): boolean {
  try {
    const fileContent = fs.readFileSync(post.filePath, 'utf8');
    const { data, content } = matter(fileContent);

    // Update the author field
    data.author = newAuthor;

    // Rebuild the file with updated frontmatter
    const updatedFile = matter.stringify(content, data);
    fs.writeFileSync(post.filePath, updatedFile);

    console.log(
      chalk.green(`✓ Updated "${post.title}" author from "${post.author}" to "${newAuthor}"`),
    );
    return true;
  } catch (error) {
    console.error(chalk.red(`✗ Failed to update "${post.title}":`, error));
    return false;
  }
}

// Display current author distribution
function showAuthorDistribution(): void {
  const posts = getAllPosts();
  const distribution: Record<string, number> = {};

  posts.forEach((post) => {
    distribution[post.author] = (distribution[post.author] || 0) + 1;
  });

  console.log(chalk.blue('\n=== Current Author Distribution ==='));
  console.log(chalk.blue(`Total posts: ${posts.length}`));

  // Sort by count descending
  const sortedAuthors = Object.entries(distribution).sort(
    ([, countA], [, countB]) => countB - countA,
  );

  console.log(chalk.blue('\nAuthor Distribution:'));
  sortedAuthors.forEach(([author, count]) => {
    const percentage = ((count / posts.length) * 100).toFixed(1);
    const isValid = isValidAuthor(author);
    const status = isValid ? chalk.green('✓') : chalk.yellow('⚠');
    console.log(`${status} ${author}: ${count} posts (${percentage}%)`);
  });

  // Show invalid authors if any
  const invalidAuthors = sortedAuthors.filter(([author]) => !isValidAuthor(author));
  if (invalidAuthors.length > 0) {
    console.log(chalk.yellow('\nNote: Authors marked with ⚠ are not in the predefined list'));
  }
}

// List all available authors
function listAvailableAuthors(): void {
  console.log(chalk.blue('\n=== Available Authors ==='));
  console.log(chalk.blue('Main Authors (from generator):'));
  AUTHORS.forEach((author, index) => {
    console.log(`  ${index + 1}. ${author}`);
  });

  console.log(chalk.blue('\nAdditional Authors (found in content):'));
  ADDITIONAL_AUTHORS.forEach((author, index) => {
    console.log(`  ${AUTHORS.length + index + 1}. ${author}`);
  });
}

// Update a specific post by slug
function updatePostBySlug(slug: string, newAuthor: string): void {
  if (!isValidAuthor(newAuthor)) {
    console.error(chalk.red(`Error: "${newAuthor}" is not a valid author.`));
    console.log(chalk.yellow('Use "list-authors" command to see available authors.'));
    return;
  }

  const posts = getAllPosts();
  const post = posts.find((p) => p.slug === slug);

  if (!post) {
    console.error(chalk.red(`Error: Post with slug "${slug}" not found.`));
    console.log(chalk.yellow('Available slugs:'));
    posts.forEach((p) => console.log(`  - ${p.slug}`));
    return;
  }

  updatePostAuthor(post, newAuthor);
}

// Find posts by title (fuzzy search)
function findPostsByTitle(searchTitle: string): PostMetadata[] {
  const posts = getAllPosts();
  const normalizedSearch = searchTitle.toLowerCase();

  return posts.filter((post) => post.title.toLowerCase().includes(normalizedSearch));
}

// Update posts by title search
function updatePostsByTitle(searchTitle: string, newAuthor: string): void {
  if (!isValidAuthor(newAuthor)) {
    console.error(chalk.red(`Error: "${newAuthor}" is not a valid author.`));
    return;
  }

  const matchingPosts = findPostsByTitle(searchTitle);

  if (matchingPosts.length === 0) {
    console.error(chalk.red(`No posts found matching title: "${searchTitle}"`));
    return;
  }

  if (matchingPosts.length > 1) {
    console.log(chalk.yellow(`Found ${matchingPosts.length} matching posts:`));
    matchingPosts.forEach((post, index) => {
      console.log(`  ${index + 1}. "${post.title}" (${post.slug}) - Author: ${post.author}`);
    });
    console.log(chalk.yellow('Please be more specific or use slug instead.'));
    return;
  }

  const post = matchingPosts[0];
  assertDefined(post);
  updatePostAuthor(post, newAuthor);
}

// Update all posts by a specific author
function updatePostsByAuthor(oldAuthor: string, newAuthor: string): void {
  if (!isValidAuthor(newAuthor)) {
    console.error(chalk.red(`Error: "${newAuthor}" is not a valid author.`));
    console.log(chalk.yellow('Use "list-authors" command to see available authors.'));
    return;
  }

  const posts = getAllPosts();
  const postsToUpdate = posts.filter((post) => post.author === oldAuthor);

  if (postsToUpdate.length === 0) {
    console.error(chalk.red(`No posts found with author "${oldAuthor}".`));
    console.log(chalk.yellow('Current authors in the system:'));
    const authors = Array.from(new Set(posts.map((post) => post.author))).sort();
    authors.forEach((author) => console.log(`  - ${author}`));
    return;
  }

  console.log(chalk.blue(`Found ${postsToUpdate.length} posts by "${oldAuthor}"`));

  let updatedCount = 0;
  postsToUpdate.forEach((post) => {
    if (updatePostAuthor(post, newAuthor)) {
      updatedCount++;
    }
  });

  console.log(
    chalk.green(
      `✓ Successfully updated ${updatedCount} of ${postsToUpdate.length} posts from "${oldAuthor}" to "${newAuthor}"`,
    ),
  );
}

// Rebalance authors to be more evenly distributed
function rebalanceAuthors(): void {
  const posts = getAllPosts();
  const mainAuthors = [...AUTHORS]; // Only use main authors for rebalancing
  const targetPerAuthor = Math.ceil(posts.length / mainAuthors.length);

  console.log(chalk.blue(`\n=== Rebalancing Authors ===`));
  console.log(chalk.blue(`Target per author: ~${targetPerAuthor} posts`));

  // Get current distribution for main authors only
  const currentDistribution: Record<string, PostMetadata[]> = {};
  mainAuthors.forEach((author) => {
    currentDistribution[author] = posts.filter((post) => post.author === author);
  });

  // Pre-compute author counts for efficient tracking during reassignment
  const authorCounts: Record<string, number> = {};
  mainAuthors.forEach((author) => {
    authorCounts[author] = currentDistribution[author]?.length || 0;
  });

  // Find posts that need reassignment (authored by non-main authors or over-represented authors)
  const postsToReassign: PostMetadata[] = [];

  // Add posts from non-main authors
  posts.forEach((post) => {
    if (!mainAuthors.includes(post.author as (typeof AUTHORS)[number])) {
      postsToReassign.push(post);
    }
  });

  // Add excess posts from over-represented authors
  mainAuthors.forEach((author) => {
    const authorPosts = currentDistribution[author] || [];
    if (authorPosts.length > targetPerAuthor) {
      const excess = authorPosts.slice(targetPerAuthor);
      postsToReassign.push(...excess);
      // Update the count to reflect posts that will be reassigned
      authorCounts[author] = targetPerAuthor;
    }
  });

  if (postsToReassign.length === 0) {
    console.log(chalk.green('Authors are already well balanced!'));
    return;
  }

  console.log(chalk.yellow(`Found ${postsToReassign.length} posts to reassign`));

  // Assign posts to authors with the fewest posts (O(n log n) instead of O(n²))
  let updatedCount = 0;
  postsToReassign.forEach((post) => {
    // Find author with least posts using pre-computed counts
    const authorWithLeast = mainAuthors.reduce((min, author) =>
      authorCounts[author] < authorCounts[min] ? author : min,
    );

    if (authorWithLeast !== post.author) {
      if (updatePostAuthor(post, authorWithLeast as ValidAuthor)) {
        authorCounts[authorWithLeast]++;
        updatedCount++;
      }
    }
  });

  console.log(chalk.green(`✓ Rebalanced ${updatedCount} posts`));
  console.log(chalk.blue('\nNew distribution:'));
  showAuthorDistribution();
}

// Command line interface
function showHelp(): void {
  console.log(chalk.blue('\n=== Update Authors Script ==='));
  console.log('Usage: bun run scripts/update-authors.ts <command> [options]\n');

  console.log('Commands:');
  console.log('  distribution     Show current author distribution');
  console.log('  list-authors     List all available authors');
  console.log('  update-slug <slug> <author>        Update author for specific post by slug');
  console.log('  update-title <title> <author>      Update author for post by title search');
  console.log('  update-author <old-author> <new-author>  Update all posts by specific author');
  console.log('  rebalance        Redistribute posts to balance author counts');
  console.log('  find <title>     Find posts matching title search');
  console.log('  help             Show this help message\n');

  console.log('Examples:');
  console.log('  bun run scripts/update-authors.ts distribution');
  console.log(
    '  bun run scripts/update-authors.ts update-slug "first-backpacking-trip" "Alex Morgan"',
  );
  console.log('  bun run scripts/update-authors.ts update-title "hiking" "Jamie Rivera"');
  console.log('  bun run scripts/update-authors.ts update-author "Unknown" "Alex Morgan"');
  console.log('  bun run scripts/update-authors.ts rebalance');
}

// Main execution
function isMainModule(): boolean {
  // For Bun/ES modules: check if this file was executed directly
  return import.meta.url === `file://${process.argv[1]}`;
}

if (isMainModule()) {
  const args = process.argv.slice(2);
  const command = args[0];

  try {
    switch (command) {
      case 'distribution':
        showAuthorDistribution();
        break;

      case 'list-authors':
        listAvailableAuthors();
        break;

      case 'update-slug':
        if (args.length < 3) {
          console.error(chalk.red('Error: Missing arguments. Usage: update-slug <slug> <author>'));
          process.exit(1);
        }
        assertDefined(args[1]);
        assertDefined(args[2]);
        updatePostBySlug(args[1], args[2]);
        break;

      case 'update-title':
        if (args.length < 3) {
          console.error(
            chalk.red('Error: Missing arguments. Usage: update-title <title> <author>'),
          );
          process.exit(1);
        }
        assertDefined(args[1]);
        assertDefined(args[2]);
        updatePostsByTitle(args[1], args[2]);
        break;

      case 'update-author':
        if (args.length < 3) {
          console.error(
            chalk.red('Error: Missing arguments. Usage: update-author <old-author> <new-author>'),
          );
          process.exit(1);
        }
        assertDefined(args[1]);
        assertDefined(args[2]);
        updatePostsByAuthor(args[1], args[2]);
        break;

      case 'find': {
        if (args.length < 2) {
          console.error(chalk.red('Error: Missing title to search. Usage: find <title>'));
          process.exit(1);
        }
        assertDefined(args[1]);
        const matchingPosts = findPostsByTitle(args[1]);
        if (matchingPosts.length === 0) {
          console.log(chalk.yellow(`No posts found matching: "${args[1]}"`));
        } else {
          console.log(chalk.blue(`Found ${matchingPosts.length} posts matching "${args[1]}":`));
          matchingPosts.forEach((post, index) => {
            console.log(`  ${index + 1}. "${post.title}" (${post.slug}) - Author: ${post.author}`);
          });
        }
        break;
      }

      case 'rebalance':
        rebalanceAuthors();
        break;

      case 'help':
      case undefined:
        showHelp();
        break;

      default:
        console.error(chalk.red(`Error: Unknown command "${command}"`));
        showHelp();
        process.exit(1);
    }
  } catch (error) {
    console.error(chalk.red('Error:'), error);
    process.exit(1);
  }
}

// Export functions for programmatic use
export {
  getAllPosts,
  showAuthorDistribution,
  updatePostAuthor,
  updatePostBySlug,
  updatePostsByTitle,
  updatePostsByAuthor,
  rebalanceAuthors,
  findPostsByTitle,
  isValidAuthor,
  AUTHORS,
  ALL_AUTHORS,
  type ValidAuthor,
  type PostMetadata,
};
