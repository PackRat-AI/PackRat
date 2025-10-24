#!/usr/bin/env bun
/**
 * Integration example: Enhanced guide generation with catalog links
 * This demonstrates how to integrate the catalog link blender with existing guide generation
 */

import chalk from 'chalk';
import { EnhancedContentGenerator } from '../lib/enhanced-content-generator';
import { type ContentCategory, generatePosts } from './generate-content';

interface GenerationOptions {
  count: number;
  categories?: ContentCategory[];
  enhanceWithCatalog: boolean;
  apiUrl?: string;
  apiKey?: string;
}

/**
 * Generate enhanced guides with catalog integration
 */
async function generateEnhancedGuides(options: GenerationOptions): Promise<void> {
  console.log(chalk.blue('🚀 Starting Enhanced Guide Generation'));

  if (options.enhanceWithCatalog) {
    console.log(chalk.blue('🔗 Catalog link enhancement: ENABLED'));

    // First, generate guides with the existing system
    console.log(chalk.blue('📝 Generating base guides...'));
    const generatedFiles = await generatePosts(options.count, options.categories);

    if (generatedFiles.length === 0) {
      console.error(chalk.red('❌ No guides were generated'));
      return;
    }

    console.log(chalk.green(`✅ Generated ${generatedFiles.length} base guides`));

    // Then enhance them with catalog links
    console.log(chalk.blue('🔧 Enhancing guides with catalog links...'));

    const config = {
      apiBaseUrl: options.apiUrl || 'http://localhost:8787',
      apiKey: options.apiKey,
      blendingOptions: {
        maxLinksPerArticle: 5,
        minSimilarityThreshold: 0.7,
      },
    };

    const enhancer = new EnhancedContentGenerator(config);
    const enhancementResults = [];

    for (let i = 0; i < generatedFiles.length; i++) {
      const file = generatedFiles[i];
      console.log(chalk.blue(`Enhancing (${i + 1}/${generatedFiles.length}): ${file}`));

      const result = await enhancer.enhanceExistingGuide(file);
      enhancementResults.push(result);

      if (result.success) {
        console.log(
          chalk.green(`  ✅ Added ${result.blendingResult.insertedLinks.length} catalog links`),
        );
      } else {
        console.log(chalk.red(`  ❌ Enhancement failed: ${result.error}`));
      }

      // Add delay to avoid rate limiting
      if (i < generatedFiles.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    // Generate report
    enhancer.generateEnhancementReport(enhancementResults);
  } else {
    console.log(chalk.yellow('🔗 Catalog link enhancement: DISABLED'));
    console.log(chalk.blue('📝 Generating standard guides...'));

    const generatedFiles = await generatePosts(options.count, options.categories);
    console.log(chalk.green(`✅ Generated ${generatedFiles.length} guides`));
  }
}

/**
 * CLI interface
 */
if (import.meta.main) {
  const args = process.argv.slice(2);

  // Parse command line arguments
  const count = args[0] ? parseInt(args[0]) : 3;
  const enhance = args.includes('--enhance') || args.includes('-e');
  const apiUrl = args.find((arg) => arg.startsWith('--api-url='))?.split('=')[1];
  const apiKey = args.find((arg) => arg.startsWith('--api-key='))?.split('=')[1];

  const categoryArgs = args.filter(
    (arg) => !arg.startsWith('-') && arg !== args[0] && !arg.startsWith('--api-'),
  ) as ContentCategory[];

  console.log(chalk.blue('🏔️  Enhanced Guide Generation Tool\n'));

  if (args.includes('--help') || args.includes('-h')) {
    console.log(
      chalk.blue('Usage: bun generate-enhanced-content.ts [count] [categories...] [options]'),
    );
    console.log(chalk.blue('\nOptions:'));
    console.log('  --enhance, -e           Enable catalog link enhancement');
    console.log('  --api-url=URL           Catalog API base URL (default: http://localhost:8787)');
    console.log('  --api-key=KEY           API authentication key');
    console.log('  --help, -h              Show this help');
    console.log(chalk.blue('\nExamples:'));
    console.log('  Generate 3 standard guides:');
    console.log(chalk.gray('    bun generate-enhanced-content.ts 3'));
    console.log('  Generate 2 enhanced guides:');
    console.log(chalk.gray('    bun generate-enhanced-content.ts 2 --enhance'));
    console.log('  Generate enhanced gear guides:');
    console.log(chalk.gray('    bun generate-enhanced-content.ts 2 gear-essentials --enhance'));
    process.exit(0);
  }

  console.log(chalk.blue(`📊 Configuration:`));
  console.log(`  Count: ${count} guides`);
  console.log(`  Categories: ${categoryArgs.length > 0 ? categoryArgs.join(', ') : 'mixed'}`);
  console.log(`  Enhancement: ${enhance ? 'enabled' : 'disabled'}`);
  if (enhance) {
    console.log(`  API URL: ${apiUrl || 'http://localhost:8787'}`);
  }
  console.log();

  const options: GenerationOptions = {
    count,
    categories: categoryArgs.length > 0 ? categoryArgs : undefined,
    enhanceWithCatalog: enhance,
    apiUrl,
    apiKey,
  };

  generateEnhancedGuides(options)
    .then(() => {
      console.log(chalk.green('\n🎉 Generation complete!'));
    })
    .catch((error) => {
      console.error(chalk.red('❌ Generation failed:', error));
      process.exit(1);
    });
}

export { generateEnhancedGuides };
