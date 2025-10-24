#!/usr/bin/env bun
/**
 * CLI script for enhancing guides with catalog item links
 *
 * Usage examples:
 * - Generate new enhanced guide: bun enhance-guides.ts generate "Essential Hiking Gear" "A guide to must-have hiking equipment"
 * - Enhance existing guide: bun enhance-guides.ts enhance path/to/guide.mdx
 * - Batch enhance all guides: bun enhance-guides.ts batch-enhance
 * - Enhance guides matching pattern: bun enhance-guides.ts batch-enhance --pattern "hiking"
 * - Generate report only: bun enhance-guides.ts report
 */

import chalk from 'chalk';
import { program } from 'commander';
import { EnhancedContentGenerator } from '../lib/enhanced-content-generator';
import type { ContentCategory } from './generate-content';

// Configure command line interface
program
  .name('enhance-guides')
  .description('Generate and enhance hiking guides with catalog item links')
  .version('1.0.0');

program
  .command('generate')
  .description('Generate a new guide with integrated catalog links')
  .argument('<title>', 'Guide title')
  .argument('<description>', 'Guide description')
  .option('-c, --categories <categories...>', 'Content categories', ['gear-essentials'])
  .option('-d, --difficulty <level>', 'Difficulty level', 'All Levels')
  .option('-a, --author <name>', 'Author name')
  .option('--api-url <url>', 'API base URL', 'http://localhost:8787')
  .option('--api-key <key>', 'API authentication key')
  .option('--max-links <number>', 'Maximum links per article', '5')
  .option('--similarity-threshold <number>', 'Minimum similarity threshold', '0.7')
  .action(async (title, description, options) => {
    try {
      console.log(chalk.blue('🚀 Generating enhanced guide with catalog links...'));

      const config = {
        apiBaseUrl: options.apiUrl,
        apiKey: options.apiKey,
        blendingOptions: {
          maxLinksPerArticle: parseInt(options.maxLinks),
          minSimilarityThreshold: parseFloat(options.similarityThreshold),
        },
      };

      const generator = new EnhancedContentGenerator(config);

      const result = await generator.generateEnhancedGuide(
        title,
        description,
        options.categories as ContentCategory[],
        options.difficulty,
        options.author,
      );

      if (result.success) {
        console.log(chalk.green(`✅ Generated: ${result.originalFile}`));
        console.log(
          chalk.blue(`🔗 Added ${result.blendingResult.insertedLinks.length} catalog links`),
        );

        // Show inserted links
        if (result.blendingResult.insertedLinks.length > 0) {
          console.log(chalk.blue('\nInserted catalog links:'));
          result.blendingResult.insertedLinks.forEach((link, i) => {
            console.log(`${i + 1}. ${link.linkText} -> ${link.item.name}`);
          });
        }
      } else {
        console.error(chalk.red(`❌ Generation failed: ${result.error}`));
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red('❌ Error:', error));
      process.exit(1);
    }
  });

program
  .command('enhance')
  .description('Enhance an existing guide with catalog links')
  .argument('<file>', 'Path to the guide file to enhance')
  .option('--api-url <url>', 'API base URL', 'http://localhost:8787')
  .option('--api-key <key>', 'API authentication key')
  .option('--max-links <number>', 'Maximum links per article', '5')
  .option('--similarity-threshold <number>', 'Minimum similarity threshold', '0.7')
  .action(async (file, options) => {
    try {
      console.log(chalk.blue(`🔧 Enhancing guide: ${file}`));

      const config = {
        apiBaseUrl: options.apiUrl,
        apiKey: options.apiKey,
        blendingOptions: {
          maxLinksPerArticle: parseInt(options.maxLinks),
          minSimilarityThreshold: parseFloat(options.similarityThreshold),
        },
      };

      const generator = new EnhancedContentGenerator(config);
      const result = await generator.enhanceExistingGuide(file);

      if (result.success) {
        console.log(chalk.green(`✅ Enhanced: ${result.enhancedFile}`));
        console.log(
          chalk.blue(`🔗 Added ${result.blendingResult.insertedLinks.length} catalog links`),
        );

        // Show inserted links
        if (result.blendingResult.insertedLinks.length > 0) {
          console.log(chalk.blue('\nInserted catalog links:'));
          result.blendingResult.insertedLinks.forEach((link, i) => {
            console.log(`${i + 1}. ${link.linkText} -> ${link.item.name}`);
          });
        }

        // Show suggestions that weren't inserted
        const suggestions =
          result.blendingResult.suggestions.length - result.blendingResult.insertedLinks.length;
        if (suggestions > 0) {
          console.log(
            chalk.yellow(
              `💡 ${suggestions} additional suggestions available (use lower similarity threshold to include more)`,
            ),
          );
        }
      } else {
        console.error(chalk.red(`❌ Enhancement failed: ${result.error}`));
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red('❌ Error:', error));
      process.exit(1);
    }
  });

program
  .command('batch-enhance')
  .description('Enhance multiple existing guides with catalog links')
  .option('-p, --pattern <pattern>', 'Only enhance files matching this pattern')
  .option('--api-url <url>', 'API base URL', 'http://localhost:8787')
  .option('--api-key <key>', 'API authentication key')
  .option('--max-links <number>', 'Maximum links per article', '5')
  .option('--similarity-threshold <number>', 'Minimum similarity threshold', '0.7')
  .option('--dry-run', 'Show what would be enhanced without making changes')
  .action(async (options) => {
    try {
      console.log(chalk.blue('📚 Batch enhancing guides...'));

      const config = {
        apiBaseUrl: options.apiUrl,
        apiKey: options.apiKey,
        blendingOptions: {
          maxLinksPerArticle: parseInt(options.maxLinks),
          minSimilarityThreshold: parseFloat(options.similarityThreshold),
        },
      };

      const generator = new EnhancedContentGenerator(config);

      if (options.dryRun) {
        console.log(chalk.yellow('🔍 Dry run mode - no files will be modified'));
        
        // Show what would be enhanced without making changes
        const fs = await import('fs');
        const path = await import('path');
        const outputDir = path.join(process.cwd(), 'content/posts');
        
        if (!fs.existsSync(outputDir)) {
          console.log(chalk.yellow(`Output directory does not exist: ${outputDir}`));
          return;
        }

        const files = fs.readdirSync(outputDir)
          .filter(file => file.endsWith('.mdx'))
          .filter(file => !file.includes('-enhanced')) // Skip already enhanced files
          .filter(file => !options.pattern || file.includes(options.pattern));

        console.log(chalk.blue(`Would enhance ${files.length} guides:`));
        files.forEach((file, i) => {
          console.log(`  ${i + 1}. ${file}`);
        });
        
        console.log(chalk.yellow('\n⚠️  Use without --dry-run to actually enhance files'));
        return;
      }

      const results = await generator.enhanceExistingGuides(options.pattern);
      generator.generateEnhancementReport(results);
    } catch (error) {
      console.error(chalk.red('❌ Error:', error));
      process.exit(1);
    }
  });

program
  .command('test-api')
  .description('Test the catalog API connection')
  .option('--api-url <url>', 'API base URL', 'http://localhost:8787')
  .option('--api-key <key>', 'API authentication key')
  .action(async (options) => {
    try {
      console.log(chalk.blue('🔍 Testing catalog API connection...'));

      const url = new URL('/api/catalog/vector-search', options.apiUrl);
      url.searchParams.set('q', 'tent');
      url.searchParams.set('limit', '3');

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (options.apiKey) {
        headers.Authorization = `Bearer ${options.apiKey}`;
      }

      const response = await fetch(url.toString(), { headers });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      console.log(chalk.green('✅ API connection successful!'));
      console.log(
        chalk.blue(`📊 Found ${data.items?.length || 0} catalog items for test query "tent"`),
      );

      if (data.items && data.items.length > 0) {
        console.log(chalk.blue('\nSample results:'));
        data.items.slice(0, 3).forEach((item: any, i: number) => {
          console.log(`${i + 1}. ${item.name} (similarity: ${item.similarity?.toFixed(3)})`);
        });
      }
    } catch (error) {
      console.error(chalk.red('❌ API test failed:', error));
      process.exit(1);
    }
  });

// Add global options
program
  .option('--verbose', 'Enable verbose logging')
  .option('--quiet', 'Suppress non-error output');

// Error handling
program.exitOverride();

try {
  program.parse();
} catch (error: any) {
  if (error.code === 'commander.help') {
    process.exit(0);
  } else if (error.code === 'commander.version') {
    process.exit(0);
  } else {
    console.error(chalk.red('❌ Command failed:', error.message));
    process.exit(1);
  }
}

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();

  console.log(chalk.blue('\n📖 Example usage:'));
  console.log('  Generate new enhanced guide:');
  console.log(
    chalk.gray(
      '    bun enhance-guides.ts generate "Essential Hiking Gear" "Complete guide to hiking equipment"',
    ),
  );
  console.log('  Enhance existing guide:');
  console.log(chalk.gray('    bun enhance-guides.ts enhance content/posts/hiking-gear.mdx'));
  console.log('  Batch enhance all guides:');
  console.log(chalk.gray('    bun enhance-guides.ts batch-enhance'));
  console.log('  Test API connection:');
  console.log(chalk.gray('    bun enhance-guides.ts test-api'));
}
