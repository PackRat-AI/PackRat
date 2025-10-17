# Update Authors Script

A TypeScript script for managing and updating authors in PackRat guides. This script allows you to view author distribution, update specific posts, and rebalance author assignments across all guides.

## Features

- **View Distribution**: See current author distribution across all guides
- **List Authors**: View all valid authors (predefined + existing custom authors)
- **Update by Slug**: Update a specific post's author using its slug
- **Update by Title**: Find and update posts by title search
- **Find Posts**: Search for posts by title
- **Rebalance**: Automatically redistribute posts to balance author counts
- **Validation**: Ensures only valid authors are used

## Prerequisites

- Bun package manager installed
- Run from the `apps/guides` directory
- Chalk dependency installed (included in package.json)

## Usage

### Quick Start

```bash
# Show current author distribution
bun run update-authors distribution

# List all available authors  
bun run update-authors list-authors

# Show help and all commands
bun run update-authors help
```

### Commands

#### 1. Show Author Distribution
```bash
bun run update-authors distribution
```
Displays current author distribution with post counts and percentages.

#### 2. List Available Authors
```bash
bun run update-authors list-authors
```
Shows all valid authors (main authors from generator + additional authors found in content).

#### 3. Update Post by Slug
```bash
bun run update-authors update-slug <slug> <author>
```
Updates a specific post's author using its slug (filename without .mdx).

**Example:**
```bash
bun run update-authors update-slug "first-backpacking-trip-step-by-step-planning-guide" "Alex Morgan"
```

#### 4. Update Post by Title Search
```bash
bun run update-authors update-title <search-term> <author>
```
Finds posts by title search and updates the author. Shows multiple matches if found.

**Example:**
```bash
bun run update-authors update-title "hiking" "Jamie Rivera"
```

#### 5. Find Posts
```bash
bun run update-authors find <search-term>
```
Search for posts matching a title term. Useful for finding the correct slug or exploring content.

**Example:**
```bash
bun run update-authors find "backpacking"
```

#### 6. Rebalance Authors
```bash
bun run update-authors rebalance
```
Automatically redistributes posts to balance author counts across the main 6 authors. This:
- Targets approximately equal posts per main author
- Reassigns posts from non-main authors to main authors
- Redistributes excess posts from over-represented authors

## Valid Authors

### Main Authors (from content generator)
1. Alex Morgan
2. Jamie Rivera  
3. Sam Washington
4. Taylor Chen
5. Jordan Smith
6. Casey Johnson

### Additional Authors (found in existing content)
7. Dr. Amanda Rivera
8. Thomas Reynolds
9. Michael Chen
10. Marcus Johnson
11. Alex Thompson
12. Jordan Williams
13. Lisa Chen
14. Sarah Johnson
15. Jamie Rodriguez

## Error Handling

The script provides helpful error messages for:
- **Invalid authors**: Shows list of valid authors
- **Non-existent posts**: Shows available slugs
- **Missing arguments**: Shows correct command usage
- **Multiple matches**: Lists all matching posts for disambiguation

## Examples

### Basic Workflow
```bash
# 1. Check current distribution
bun run update-authors distribution

# 2. Find a post to update
bun run update-authors find "hiking"

# 3. Update specific post
bun run update-authors update-slug "essential-hiking-gear" "Alex Morgan"

# 4. Verify the change
bun run update-authors distribution
```

### Bulk Rebalancing
```bash
# Current state: uneven distribution
bun run update-authors distribution

# Rebalance to even distribution
bun run update-authors rebalance

# Verify new distribution
bun run update-authors distribution
```

## Script Location

The script is located at:
```
apps/guides/scripts/update-authors.ts
```

## Dependencies

- `chalk` - For colored terminal output
- `gray-matter` - For parsing MDX frontmatter
- `fs` & `path` - For file operations
- Node.js built-in modules

## Programmatic Usage

The script exports functions for programmatic use:

```typescript
import { 
  getAllPosts, 
  updatePostAuthor, 
  showAuthorDistribution,
  rebalanceAuthors,
  type ValidAuthor 
} from './scripts/update-authors.ts';

// Get all posts with metadata
const posts = getAllPosts();

// Update a specific post
updatePostAuthor(posts[0], 'Alex Morgan');

// Show distribution
showAuthorDistribution();
```

## Contributing

When adding new authors:
1. Add them to the `ADDITIONAL_AUTHORS` array in the script
2. Update this README with the new author
3. Test with the `list-authors` command

## Troubleshooting

**"Cannot find package 'chalk'"**
- Run `bun add chalk` in the `apps/guides` directory

**"Posts directory not found"**
- Ensure you're running from `apps/guides` directory
- Check that `content/posts/` exists

**"Post not found"**
- Use `find` command to search for the correct slug
- Check the slug matches the filename without `.mdx`