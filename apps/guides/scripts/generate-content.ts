import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import chalk from 'chalk';
import { format } from 'date-fns';
import fs from 'fs';
import matter from 'gray-matter';
import { assertDefined } from 'guides-app/lib/assertDefined';
import path from 'path';
import slugify from 'slugify';
import { GuideCatalogSearchTool } from '../../../packages/api/src/utils/guideCatalogSearch';
import type { Env } from '../../../packages/api/src/utils/env-validation';

// Types
type ContentCategory =
  | 'gear-essentials'
  | 'pack-strategy'
  | 'weight-management'
  | 'trip-planning'
  | 'seasonal-guides'
  | 'activity-specific'
  | 'destination-guides'
  | 'maintenance'
  | 'emergency-prep'
  | 'family-adventures'
  | 'budget-options'
  | 'sustainability'
  | 'tech-outdoors'
  | 'food-nutrition'
  | 'beginner-resources';

type DifficultyLevel = 'Beginner' | 'Intermediate' | 'Advanced' | 'All Levels';

interface ContentRequest {
  title: string;
  description?: string;
  categories: ContentCategory[];
  difficulty?: DifficultyLevel;
  author?: string;
  generateFullContent?: boolean;
  includeCatalogLinks?: boolean; // New option to enable catalog search integration
}

interface ContentMetadata {
  title: string;
  description: string;
  date: string;
  categories: ContentCategory[];
  author: string;
  readingTime: string;
  difficulty: DifficultyLevel;
  coverImage: string;
  slug: string;
}

// Configuration
const OUTPUT_DIR = path.join(process.cwd(), 'content/posts');
const AUTHORS = [
  'Alex Morgan',
  'Jamie Rivera',
  'Sam Washington',
  'Taylor Chen',
  'Jordan Smith',
  'Casey Johnson',
];

const CATEGORY_DISPLAY_NAMES: Record<ContentCategory, string> = {
  'gear-essentials': 'Gear Essentials',
  'pack-strategy': 'Pack Strategy',
  'weight-management': 'Weight Management',
  'trip-planning': 'Trip Planning',
  'seasonal-guides': 'Seasonal Guides',
  'activity-specific': 'Activity-Specific',
  'destination-guides': 'Destination Guides',
  maintenance: 'Maintenance',
  'emergency-prep': 'Emergency Prep',
  'family-adventures': 'Family Adventures',
  'budget-options': 'Budget Options',
  sustainability: 'Sustainability',
  'tech-outdoors': 'Tech Outdoors',
  'food-nutrition': 'Food & Nutrition',
  'beginner-resources': 'Beginner Resources',
};

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  console.log(chalk.green(`✓ Created output directory: ${OUTPUT_DIR}`));
}

// Initialize environment for catalog search
function getEnvForCatalog(): Env {
  return {
    NEON_DATABASE_URL: process.env.NEON_DATABASE_URL || '',
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
    AI_PROVIDER: (process.env.AI_PROVIDER as any) || 'openai',
    CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID || '',
    CLOUDFLARE_AI_GATEWAY_ID: process.env.CLOUDFLARE_AI_GATEWAY_ID || '',
  } as Env;
}

// Generate a slug from title
function createSlug(title: string): string {
  return slugify(title, {
    lower: true,
    strict: true,
    remove: /[*+~.()'"!:@]/g,
  });
}

// Generate random reading time between 5-15 minutes
function generateReadingTime(): string {
  const minutes = Math.floor(Math.random() * 11) + 5;
  return `${minutes} min read`;
}

// Generate a random author if not provided
function getRandomAuthor(): string {
  const author = AUTHORS[Math.floor(Math.random() * AUTHORS.length)];
  assertDefined(author);
  return author;
}

// Extract JSON from text that might contain markdown code blocks
function extractJsonFromText(text: string): string {
  // Look for JSON content between code blocks
  const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonMatch?.[1]) {
    return jsonMatch[1].trim();
  }

  // If no code blocks, try to find JSON array directly
  const arrayMatch = text.match(/\[\s*\{[\s\S]*\}\s*\]/);
  if (arrayMatch) {
    return arrayMatch[0];
  }

  // Return the original text if no patterns match
  return text;
}

// Get existing content metadata
function getExistingContent(): ContentMetadata[] {
  if (!fs.existsSync(OUTPUT_DIR)) {
    return [];
  }

  const files = fs.readdirSync(OUTPUT_DIR).filter((file) => file.endsWith('.mdx'));
  const existingContent: ContentMetadata[] = [];

  for (const file of files) {
    try {
      const filePath = path.join(OUTPUT_DIR, file);
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const { data } = matter(fileContent);

      // Convert frontmatter data to ContentMetadata
      const metadata: ContentMetadata = {
        title: data.title || '',
        description: data.description || '',
        date: data.date || '',
        categories: data.categories || [],
        author: data.author || '',
        readingTime: data.readingTime || '',
        difficulty: data.difficulty || 'All Levels',
        coverImage: data.coverImage || '',
        slug: file.replace('.mdx', ''),
      };

      existingContent.push(metadata);
    } catch (error) {
      console.error(chalk.yellow(`Warning: Could not parse ${file}`), error);
    }
  }

  return existingContent;
}

// Generate topic ideas based on categories and existing content
async function generateTopicIdeas(
  count: number,
  categories?: ContentCategory[],
  existingContent: ContentMetadata[] = [],
): Promise<ContentMetadata[]> {
  console.log(chalk.blue(`Generating ${count} topic ideas...`));

  const categoryPrompt =
    categories && categories.length > 0
      ? `Focus on these categories: ${categories.map((c) => CATEGORY_DISPLAY_NAMES[c]).join(', ')}.`
      : 'Distribute topics across various outdoor adventure categories.';

  // Create a summary of existing content to provide context
  let existingContentPrompt = '';
  if (existingContent.length > 0) {
    // Limit to 20 most recent articles to avoid token limits
    const recentContent = existingContent
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 20);

    existingContentPrompt = `
    Here are some existing articles we already have (showing ${
      recentContent.length
    } of ${existingContent.length} total):
    ${recentContent
      .map(
        (content) =>
          `- "${content.title}" (Categories: ${content.categories
            .map((c) => CATEGORY_DISPLAY_NAMES[c])
            .join(', ')}, Difficulty: ${content.difficulty})`,
      )
      .join('\n')}
    
    Please generate ideas that are distinct from these existing articles and cover new angles or topics.
    `;

    // Add category distribution analysis
    const categoryDistribution: Record<ContentCategory, number> = {} as Record<
      ContentCategory,
      number
    >;
    existingContent.forEach((content) => {
      content.categories.forEach((category) => {
        categoryDistribution[category] = (categoryDistribution[category] || 0) + 1;
      });
    });

    // Find underrepresented categories
    const sortedCategories = Object.entries(categoryDistribution)
      .sort(([, countA], [, countB]) => countA - countB)
      .map(([category]) => category as ContentCategory);

    if (sortedCategories.length > 0 && !categories) {
      const underrepresentedCategories = sortedCategories.slice(0, 3);
      existingContentPrompt += `
      Consider focusing on these underrepresented categories: ${underrepresentedCategories
        .map((c) => CATEGORY_DISPLAY_NAMES[c])
        .join(', ')}.
      `;
    }
  }

  const { text } = await generateText({
    model: openai('gpt-4o'),
    prompt: `Generate ${count} unique hiking and outdoor adventure blog post ideas for an app focused on pack management and trip planning. ${categoryPrompt}
    
    ${existingContentPrompt}
    
    For each idea, provide:
    1. Title - Make it SEO-friendly and engaging
    2. Brief description (1-2 sentences)
    3. 2-3 relevant categories from this list: ${Object.values(CATEGORY_DISPLAY_NAMES).join(', ')}
    4. Difficulty level: Beginner, Intermediate, Advanced, or All Levels
    
    Format as JSON array with properties: title, description, categories, difficulty.
    
    Example:
    [
      {
        "title": "10 Essential Items Every Hiker Should Pack",
        "description": "A comprehensive guide to the must-have items for any hiking trip, regardless of duration or difficulty.",
        "categories": ["Gear Essentials", "Beginner Resources"],
        "difficulty": "All Levels"
      }
    ]`,
    temperature: 0.7,
  });

  try {
    // Extract JSON from the text response which might contain markdown code blocks
    const jsonText = extractJsonFromText(text);
    const ideas = JSON.parse(jsonText);

    // Transform the data to match our internal format
    return ideas.map(
      (idea: { title: string; description: string; categories: string[]; difficulty: string }) => {
        // Map display category names back to our internal keys
        const categoryKeys = idea.categories.map((displayName: string) => {
          const entry = Object.entries(CATEGORY_DISPLAY_NAMES).find(
            ([_, value]) => value.toLowerCase() === displayName.toLowerCase(),
          );
          return entry ? (entry[0] as ContentCategory) : 'gear-essentials';
        });

        return {
          title: idea.title,
          description: idea.description,
          date: format(new Date(), 'yyyy-MM-dd'),
          categories: categoryKeys,
          author: getRandomAuthor(),
          readingTime: generateReadingTime(),
          difficulty: idea.difficulty as DifficultyLevel,
          coverImage: '/placeholder.svg?height=400&width=800',
          slug: createSlug(idea.title),
        };
      },
    );
  } catch (error) {
    console.error(chalk.red('Error parsing generated topics:'), error);
    console.log(chalk.yellow('Raw response:'), text);
    return [];
  }
}

// Generate full MDX content for a topic with awareness of existing content and catalog integration
async function generateMdxContent(
  metadata: ContentMetadata,
  existingContent: ContentMetadata[] = [],
  includeCatalogLinks: boolean = true,
): Promise<string> {
  console.log(chalk.blue(`Generating content for: ${metadata.title}`));

  const categoryNames = metadata.categories.map((c) => CATEGORY_DISPLAY_NAMES[c]);

  // Find related articles for cross-referencing
  const relatedArticles = existingContent
    .filter(
      (content) =>
        content.categories.some((category) => metadata.categories.includes(category)) &&
        content.title !== metadata.title,
    )
    .sort((a, b) => {
      // Count matching categories
      const aMatches = a.categories.filter((c) => metadata.categories.includes(c)).length;
      const bMatches = b.categories.filter((c) => metadata.categories.includes(c)).length;
      return bMatches - aMatches;
    })
    .slice(0, 3); // Get top 3 related articles

  let relatedArticlesPrompt = '';
  if (relatedArticles.length > 0) {
    relatedArticlesPrompt = `
    Here are some related articles that already exist in our blog:
    ${relatedArticles.map((article) => `- "${article.title}" (${article.description})`).join('\n')}
    
    You can reference these articles where appropriate, but make sure your content is unique and provides new value.
    `;
  }

  // Initialize catalog search for gear recommendations
  let catalogRecommendations = '';
  if (includeCatalogLinks && process.env.NEON_DATABASE_URL) {
    try {
      const catalogSearchTool = new GuideCatalogSearchTool(getEnvForCatalog());
      
      // Extract potential gear terms from title and description
      const searchTerms = catalogSearchTool.extractGearTerms(`${metadata.title} ${metadata.description}`);
      
      // Also search for category-specific items
      const categorySearchTerms: string[] = [];
      metadata.categories.forEach(category => {
        switch (category) {
          case 'gear-essentials':
            categorySearchTerms.push('backpack', 'sleeping bag', 'tent');
            break;
          case 'pack-strategy':
            categorySearchTerms.push('backpack', 'packing cubes', 'stuff sack');
            break;
          case 'weight-management':
            categorySearchTerms.push('lightweight gear', 'ultralight backpack');
            break;
          case 'seasonal-guides':
            categorySearchTerms.push('winter gear', 'summer gear');
            break;
          case 'food-nutrition':
            categorySearchTerms.push('camp stove', 'cookware', 'water filter');
            break;
          default:
            break;
        }
      });

      // Combine all search terms and deduplicate
      const allSearchTerms = Array.from(new Set([...searchTerms, ...categorySearchTerms])).slice(0, 5);
      
      if (allSearchTerms.length > 0) {
        console.log(chalk.yellow(`Searching catalog for terms: ${allSearchTerms.join(', ')}`));
        
        // Search catalog for relevant items
        const searchResults = await catalogSearchTool.batchSearchCatalogForGuides(allSearchTerms, {
          limit: 3,
          minRating: 3.5, // Only include well-rated items
        });

        // Collect top recommendations
        const topItems = Object.values(searchResults)
          .flatMap(result => result.items)
          .filter((item, index, self) => index === self.findIndex(t => t.id === item.id)) // Remove duplicates
          .sort((a, b) => (b.ratingValue || 0) - (a.ratingValue || 0)) // Sort by rating
          .slice(0, 8); // Take top 8 items

        if (topItems.length > 0) {
          catalogRecommendations = `
          
Available gear recommendations from our catalog:
${topItems.map(item => {
  const brandInfo = item.brand ? ` (${item.brand})` : '';
  const priceInfo = item.price ? ` - $${item.price.toFixed(2)}` : '';
  const ratingInfo = item.ratingValue ? ` ⭐ ${item.ratingValue.toFixed(1)}` : '';
  return `- ${item.name}${brandInfo}${priceInfo}${ratingInfo} - ${item.productUrl}`;
}).join('\n')}

You can reference these specific products in your recommendations where appropriate, using their exact names and including links to their product pages.`;
        }
      }
    } catch (error) {
      console.warn(chalk.yellow('Warning: Could not fetch catalog recommendations:'), error);
      // Continue without catalog recommendations
    }
  }

  const { text } = await generateText({
    model: openai('gpt-4o-mini'),
    prompt: `Write a comprehensive blog post about "${
      metadata.title
    }" for an outdoor adventure planning app that helps users manage packs and items for trips.
    
    ${relatedArticlesPrompt}
    ${catalogRecommendations}
    
    The post should:
    - Target these categories: ${categoryNames.join(', ')}
    - Be appropriate for ${metadata.difficulty} difficulty level
    - Start with an introduction that expands on this description: "${metadata.description}"
    - Include 4-6 main sections with clear subheadings
    - Provide practical, actionable advice related to packing and trip planning
    - Include specific gear recommendations where appropriate${catalogRecommendations ? ', using the catalog items provided above when relevant' : ''}
    - End with a conclusion
    - Be SEO-optimized for the title keywords
    - Be informative enough to be used in a retrieval-augmented generation (RAG) system
    ${
      relatedArticles.length > 0
        ? '- Include 1-2 references to related articles where appropriate'
        : ''
    }
    
    Format the content in MDX format with proper markdown headings, lists, and emphasis.
    Do not include the frontmatter - that will be added separately.
    Start directly with the main heading (# Title) and content.${catalogRecommendations ? '\n\nWhen recommending specific gear, include markdown links to the product URLs provided in the catalog recommendations.' : ''}`,
    temperature: 0.7,
  });

  return text;
}

// Create frontmatter for MDX file
function createFrontmatter(metadata: ContentMetadata): string {
  return `---
title: "${metadata.title}"
description: "${metadata.description}"
date: ${metadata.date}
categories: [${metadata.categories.map((c) => `"${c}"`).join(', ')}]
author: "${metadata.author}"
readingTime: "${metadata.readingTime}"
difficulty: "${metadata.difficulty}"
coverImage: "${metadata.coverImage}"
---`;
}

// Generate a single post
async function generatePost(
  request: ContentRequest,
  existingContent: ContentMetadata[] = [],
): Promise<string> {
  try {
    // Set defaults for missing fields
    const metadata: ContentMetadata = {
      title: request.title,
      description: request.description || `A guide about ${request.title} for outdoor enthusiasts.`,
      date: format(new Date(), 'yyyy-MM-dd'),
      categories: request.categories,
      author: request.author || getRandomAuthor(),
      readingTime: generateReadingTime(),
      difficulty: request.difficulty || 'All Levels',
      coverImage: '/placeholder.svg?height=400&width=800',
      slug: createSlug(request.title),
    };

    // Generate content if requested
    let content = '';
    if (request.generateFullContent) {
      content = await generateMdxContent(metadata, existingContent, request.includeCatalogLinks);
    } else {
      content = `# ${metadata.title}\n\n${metadata.description}\n\n## Introduction\n\nThis is a placeholder for the full article content.`;
    }

    // Combine frontmatter and content
    const frontmatter = createFrontmatter(metadata);
    const mdxContent = `${frontmatter}\n\n${content}`;

    // Write to file
    const filePath = path.join(OUTPUT_DIR, `${metadata.slug}.mdx`);
    fs.writeFileSync(filePath, mdxContent);

    console.log(chalk.green(`✓ Created: ${filePath}`));
    return filePath;
  } catch (error) {
    console.error(chalk.red(`Error generating post "${request.title}":`, error));
    return '';
  }
}

// Generate multiple posts
async function generatePosts(count: number, categories?: ContentCategory[]): Promise<string[]> {
  try {
    // Get existing content first
    const existingContent = getExistingContent();
    console.log(chalk.blue(`Found ${existingContent.length} existing articles`));

    // Generate topic ideas with awareness of existing content
    const topics = await generateTopicIdeas(count, categories, existingContent);
    console.log(chalk.green(`✓ Generated ${topics.length} topic ideas`));

    // Generate content for each topic
    const filePaths: string[] = [];
    for (let i = 0; i < topics.length; i++) {
      const topic = topics[i];
      assertDefined(topic);
      console.log(chalk.blue(`Processing (${i + 1}/${topics.length}): ${topic.title}`));

      const request: ContentRequest = {
        title: topic.title,
        description: topic.description,
        categories: topic.categories,
        difficulty: topic.difficulty,
        author: topic.author,
        generateFullContent: true,
      };

      // Pass existing content to generatePost for context
      const filePath = await generatePost(request, existingContent);
      if (filePath) {
        filePaths.push(filePath);

        // Add the newly created post to existingContent for context in subsequent generations
        existingContent.push(topic);
      }

      // Add a small delay to avoid rate limiting
      if (i < topics.length - 1) {
        console.log(chalk.yellow('Waiting before next generation...'));
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    console.log(chalk.green(`✓ Generated ${filePaths.length} posts successfully!`));
    return filePaths;
  } catch (error) {
    console.error(chalk.red('Error in batch generation:'), error);
    return [];
  }
}

// Generate a content distribution report
function generateContentReport(): void {
  const existingContent = getExistingContent();
  if (existingContent.length === 0) {
    console.log(chalk.yellow('No content found to generate report'));
    return;
  }

  console.log(chalk.blue(`\n=== Content Distribution Report ===`));
  console.log(chalk.blue(`Total articles: ${existingContent.length}`));

  // Category distribution
  const categoryDistribution: Record<string, number> = {};
  existingContent.forEach((content) => {
    content.categories.forEach((category) => {
      const displayName = CATEGORY_DISPLAY_NAMES[category];
      categoryDistribution[displayName] = (categoryDistribution[displayName] || 0) + 1;
    });
  });

  console.log(chalk.blue(`\nCategory Distribution:`));
  Object.entries(categoryDistribution)
    .sort(([, countA], [, countB]) => countB - countA)
    .forEach(([category, count]) => {
      const percentage = ((count / existingContent.length) * 100).toFixed(1);
      console.log(`${category}: ${count} (${percentage}%)`);
    });

  // Difficulty distribution
  const difficultyDistribution: Record<string, number> = {};
  existingContent.forEach((content) => {
    difficultyDistribution[content.difficulty] =
      (difficultyDistribution[content.difficulty] || 0) + 1;
  });

  console.log(chalk.blue(`\nDifficulty Distribution:`));
  Object.entries(difficultyDistribution)
    .sort(([, countA], [, countB]) => countB - countA)
    .forEach(([difficulty, count]) => {
      const percentage = ((count / existingContent.length) * 100).toFixed(1);
      console.log(`${difficulty}: ${count} (${percentage}%)`);
    });

  // Author distribution
  const authorDistribution: Record<string, number> = {};
  existingContent.forEach((content) => {
    authorDistribution[content.author] = (authorDistribution[content.author] || 0) + 1;
  });

  console.log(chalk.blue(`\nAuthor Distribution:`));
  Object.entries(authorDistribution)
    .sort(([, countA], [, countB]) => countB - countA)
    .forEach(([author, count]) => {
      const percentage = ((count / existingContent.length) * 100).toFixed(1);
      console.log(`${author}: ${count} (${percentage}%)`);
    });
}

// Export functions for use in the frontend
export {
  CATEGORY_DISPLAY_NAMES,
  generateContentReport,
  generatePost,
  generatePosts,
  generateTopicIdeas,
  getExistingContent,
  type ContentCategory,
  type ContentMetadata,
  type ContentRequest,
  type DifficultyLevel,
};

// Command line interface
if (require.main === module) {
  // This will only run when the script is executed directly
  const args = process.argv.slice(2);

  // Check for report command
  if (args[0] === 'report') {
    generateContentReport();
    process.exit(0);
  }

  const count = (args[0] && Number.parseInt(args[0])) || 5;
  const categoryArgs = args.slice(1) as ContentCategory[];

  console.log(chalk.blue(`Starting content generation: ${count} posts`));
  if (categoryArgs.length > 0) {
    console.log(
      chalk.blue(
        `Focusing on categories: ${categoryArgs.map((c) => CATEGORY_DISPLAY_NAMES[c]).join(', ')}`,
      ),
    );
  }

  generatePosts(count, categoryArgs.length > 0 ? categoryArgs : undefined)
    .then(() => console.log(chalk.green('Generation complete!')))
    .catch((err) => console.error(chalk.red('Generation failed:'), err));
}
