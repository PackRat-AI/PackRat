import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import chalk from 'chalk';
import { format } from 'date-fns';
import fs from 'fs';
import matter from 'gray-matter';
import path from 'path';
import type { ContentCategory, ContentMetadata } from '../scripts/generate-content';
import { assertDefined } from './assertDefined';
import type { BlendingOptions, BlendingResult } from './catalog-link-blender';
import { type CatalogLinkBlender, createCatalogLinkBlender } from './catalog-link-blender';

// Configuration for enhanced content generation
export interface EnhancedContentConfig {
  apiBaseUrl: string;
  apiKey?: string;
  blendingOptions?: BlendingOptions;
  outputDir?: string;
}

// Results from enhancing a guide
export interface GuideEnhancementResult {
  originalFile: string;
  enhancedFile?: string;
  blendingResult: BlendingResult;
  success: boolean;
  error?: string;
}

/**
 * Enhanced Content Generator that integrates catalog link blending with guide creation
 */
export class EnhancedContentGenerator {
  private blender: CatalogLinkBlender;
  private config: Required<EnhancedContentConfig>;

  constructor(config: EnhancedContentConfig) {
    this.config = {
      apiBaseUrl: config.apiBaseUrl,
      apiKey: config.apiKey,
      blendingOptions: config.blendingOptions || {},
      outputDir: config.outputDir || path.join(process.cwd(), 'content/posts'),
    };

    this.blender = createCatalogLinkBlender(
      this.config.apiBaseUrl,
      this.config.apiKey,
      this.config.blendingOptions,
    );
  }

  /**
   * Generate new content with integrated catalog links
   */
  async generateEnhancedGuide(
    title: string,
    description: string,
    categories: ContentCategory[],
    difficulty: 'Beginner' | 'Intermediate' | 'Advanced' | 'All Levels' = 'All Levels',
    author?: string,
  ): Promise<GuideEnhancementResult> {
    try {
      console.log(chalk.blue(`Generating enhanced guide: ${title}`));

      // First, generate the base content using AI
      const baseContent = await this.generateBaseContent(
        title,
        description,
        categories,
        difficulty,
      );

      // Create metadata for the guide
      const metadata: ContentMetadata = {
        title,
        description,
        date: format(new Date(), 'yyyy-MM-dd'),
        categories,
        author: author || this.getRandomAuthor(),
        readingTime: this.estimateReadingTime(baseContent),
        difficulty,
        coverImage: '/placeholder.svg?height=400&width=800',
        slug: this.createSlug(title),
      };

      // Enhance the content with catalog links
      const blendingResult = await this.blender.enhanceGuideContent(baseContent, {
        title: metadata.title,
        categories: metadata.categories,
        difficulty: metadata.difficulty,
      });

      // Save the enhanced content
      const filePath = await this.saveEnhancedContent(metadata, blendingResult.enhancedContent);

      console.log(
        chalk.green(
          `✅ Generated enhanced guide with ${blendingResult.insertedLinks.length} catalog links`,
        ),
      );

      return {
        originalFile: filePath,
        enhancedFile: filePath,
        blendingResult,
        success: true,
      };
    } catch (error) {
      console.error(chalk.red(`❌ Error generating enhanced guide "${title}":`, error));
      return {
        originalFile: '',
        blendingResult: {
          originalContent: '',
          enhancedContent: '',
          insertedLinks: [],
          suggestions: [],
        },
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Enhance an existing guide file with catalog links
   */
  async enhanceExistingGuide(filePath: string): Promise<GuideEnhancementResult> {
    try {
      console.log(chalk.blue(`Enhancing existing guide: ${filePath}`));

      // Read and parse the existing file
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const { data: frontmatter, content } = matter(fileContent);

      // Enhance the content with catalog links
      const blendingResult = await this.blender.enhanceGuideContent(content, {
        title: frontmatter.title,
        categories: frontmatter.categories,
        difficulty: frontmatter.difficulty,
      });

      // Create enhanced version with new filename
      const parsedPath = path.parse(filePath);
      const enhancedFilePath = path.join(
        parsedPath.dir,
        `${parsedPath.name}-enhanced${parsedPath.ext}`,
      );

      // Save the enhanced version
      const enhancedMdx = matter.stringify(blendingResult.enhancedContent, frontmatter);
      fs.writeFileSync(enhancedFilePath, enhancedMdx);

      console.log(
        chalk.green(`✅ Enhanced guide with ${blendingResult.insertedLinks.length} catalog links`),
      );
      console.log(chalk.blue(`💡 Enhanced version saved to: ${enhancedFilePath}`));

      return {
        originalFile: filePath,
        enhancedFile: enhancedFilePath,
        blendingResult,
        success: true,
      };
    } catch (error) {
      console.error(chalk.red(`❌ Error enhancing guide "${filePath}":`, error));
      return {
        originalFile: filePath,
        blendingResult: {
          originalContent: '',
          enhancedContent: '',
          insertedLinks: [],
          suggestions: [],
        },
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Enhance multiple existing guides in batch
   */
  async enhanceExistingGuides(pattern?: string): Promise<GuideEnhancementResult[]> {
    const results: GuideEnhancementResult[] = [];

    if (!fs.existsSync(this.config.outputDir)) {
      console.log(chalk.yellow(`Output directory does not exist: ${this.config.outputDir}`));
      return results;
    }

    const files = fs
      .readdirSync(this.config.outputDir)
      .filter((file) => file.endsWith('.mdx'))
      .filter((file) => !file.includes('-enhanced')) // Skip already enhanced files
      .filter((file) => !pattern || file.includes(pattern));

    console.log(chalk.blue(`Found ${files.length} guides to enhance`));

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      assertDefined(file);

      const filePath = path.join(this.config.outputDir, file);
      console.log(chalk.blue(`Processing (${i + 1}/${files.length}): ${file}`));

      const result = await this.enhanceExistingGuide(filePath);
      results.push(result);

      // Add delay to avoid rate limiting
      if (i < files.length - 1) {
        console.log(chalk.yellow('Waiting before next enhancement...'));
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    const successful = results.filter((r) => r.success).length;
    console.log(chalk.green(`✅ Enhanced ${successful}/${files.length} guides successfully`));

    return results;
  }

  /**
   * Generate an enhancement report for guides
   */
  generateEnhancementReport(results: GuideEnhancementResult[]): void {
    console.log(chalk.blue('\n=== Catalog Link Enhancement Report ==='));

    const successful = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);

    console.log(chalk.blue(`Total guides processed: ${results.length}`));
    console.log(chalk.green(`Successfully enhanced: ${successful.length}`));
    console.log(chalk.red(`Failed: ${failed.length}`));

    if (successful.length > 0) {
      const totalLinks = successful.reduce(
        (sum, result) => sum + result.blendingResult.insertedLinks.length,
        0,
      );
      const avgLinks = (totalLinks / successful.length).toFixed(1);

      console.log(chalk.blue(`\nLink Statistics:`));
      console.log(`Total links inserted: ${totalLinks}`);
      console.log(`Average links per guide: ${avgLinks}`);

      // Show distribution of link counts
      const linkDistribution: Record<number, number> = {};
      successful.forEach((result) => {
        const count = result.blendingResult.insertedLinks.length;
        linkDistribution[count] = (linkDistribution[count] || 0) + 1;
      });

      console.log(chalk.blue(`\nLinks per guide distribution:`));
      Object.entries(linkDistribution)
        .sort(([a], [b]) => Number(a) - Number(b))
        .forEach(([count, guides]) => {
          console.log(`${count} links: ${guides} guides`);
        });

      // Show most commonly linked items
      const itemCounts: Record<string, number> = {};
      successful.forEach((result) => {
        result.blendingResult.insertedLinks.forEach((link) => {
          itemCounts[link.item.name] = (itemCounts[link.item.name] || 0) + 1;
        });
      });

      const topItems = Object.entries(itemCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10);

      if (topItems.length > 0) {
        console.log(chalk.blue(`\nMost frequently linked items:`));
        topItems.forEach(([item, count]) => {
          console.log(`${item}: ${count} times`);
        });
      }
    }

    if (failed.length > 0) {
      console.log(chalk.red(`\nFailed enhancements:`));
      failed.forEach((result) => {
        console.log(chalk.red(`- ${result.originalFile}: ${result.error}`));
      });
    }
  }

  /**
   * Generate base content using AI (similar to existing generate-content.ts)
   */
  private async generateBaseContent(
    title: string,
    description: string,
    categories: ContentCategory[],
    difficulty: string,
  ): Promise<string> {
    const { text } = await generateText({
      model: openai('gpt-4o-mini'),
      prompt: `Write a comprehensive blog post about "${title}" for an outdoor adventure planning app that helps users manage packs and items for trips.

The post should:
- Target difficulty level: ${difficulty}
- Cover these categories: ${categories.join(', ')}
- Start with an introduction that expands on: "${description}"
- Include 4-6 main sections with clear subheadings
- Provide practical, actionable advice related to packing and trip planning
- Mention specific types of gear and equipment that hikers would use
- Include outdoor gear categories and equipment names naturally in context
- Be detailed enough for semantic analysis and product matching
- End with a conclusion
- Be SEO-optimized and informative

Format in markdown with proper headings (# ## ###), lists, and emphasis.
Start with the main heading and content (no frontmatter).
Focus on mentioning specific gear types, brands when relevant, and equipment categories.`,
      temperature: 0.7,
    });

    return text;
  }

  /**
   * Save enhanced content to file
   */
  private async saveEnhancedContent(metadata: ContentMetadata, content: string): Promise<string> {
    const mdxContent = matter.stringify(content, metadata);
    const filePath = path.join(this.config.outputDir, `${metadata.slug}.mdx`);

    // Ensure output directory exists
    if (!fs.existsSync(this.config.outputDir)) {
      fs.mkdirSync(this.config.outputDir, { recursive: true });
    }

    fs.writeFileSync(filePath, mdxContent);
    return filePath;
  }

  /**
   * Utility methods
   */
  private createSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }

  private estimateReadingTime(content: string): string {
    const wordsPerMinute = 200;
    const wordCount = content.split(/\s+/).length;
    const minutes = Math.ceil(wordCount / wordsPerMinute);
    return `${minutes} min read`;
  }

  private getRandomAuthor(): string {
    const authors = [
      'Alex Morgan',
      'Jamie Rivera',
      'Sam Washington',
      'Taylor Chen',
      'Jordan Smith',
      'Casey Johnson',
    ];
    const author = authors[Math.floor(Math.random() * authors.length)];
    assertDefined(author);
    return author;
  }
}

/**
 * CLI interface for the enhanced content generator
 */
export interface CLIOptions {
  command: 'generate' | 'enhance' | 'batch-enhance' | 'report';
  title?: string;
  description?: string;
  categories?: string[];
  difficulty?: string;
  file?: string;
  pattern?: string;
  apiUrl?: string;
  apiKey?: string;
}

export async function runCLI(options: CLIOptions): Promise<void> {
  const config: EnhancedContentConfig = {
    apiBaseUrl: options.apiUrl || 'http://localhost:8787',
    apiKey: options.apiKey,
  };

  const generator = new EnhancedContentGenerator(config);

  switch (options.command) {
    case 'generate':
      if (!options.title || !options.description) {
        console.error(chalk.red('Title and description are required for generate command'));
        return;
      }
      await generator.generateEnhancedGuide(
        options.title,
        options.description,
        (options.categories as ContentCategory[]) || ['gear-essentials'],
        (options.difficulty as any) || 'All Levels',
      );
      break;

    case 'enhance':
      if (!options.file) {
        console.error(chalk.red('File path is required for enhance command'));
        return;
      }
      await generator.enhanceExistingGuide(options.file);
      break;

    case 'batch-enhance': {
      const results = await generator.enhanceExistingGuides(options.pattern);
      generator.generateEnhancementReport(results);
      break;
    }

    default:
      console.error(chalk.red(`Unknown command: ${options.command}`));
  }
}
