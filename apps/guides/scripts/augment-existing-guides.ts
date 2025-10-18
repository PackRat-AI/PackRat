#!/usr/bin/env bun

import { GearAugmentationService } from '@packrat/api/services';
import chalk from 'chalk';
import fs from 'fs';
import matter from 'gray-matter';
import { assertDefined } from 'guides-app/lib/assertDefined';
import path from 'path';

// Configuration
const CONTENT_DIR = path.join(process.cwd(), 'content/posts');
const BACKUP_DIR = path.join(process.cwd(), 'content/posts-backup');

interface AugmentOptions {
  dryRun?: boolean;
  maxProductsPerGear?: number;
  similarityThreshold?: number;
  filePattern?: string;
  skipBackup?: boolean;
}

// Ensure required environment variables are set
function validateEnvironment() {
  const requiredEnvVars = ['OPENAI_API_KEY'];
  const missingEnvVars = requiredEnvVars.filter((varName) => !process.env[varName]);

  if (missingEnvVars.length > 0) {
    console.error(
      chalk.red(`❌ Missing required environment variables: ${missingEnvVars.join(', ')}`),
    );
    console.error(chalk.yellow('Please set these in your .env file or environment'));
    process.exit(1);
  }
}

// Get list of MDX files to process
function getGuideFiles(filePattern?: string): string[] {
  if (!fs.existsSync(CONTENT_DIR)) {
    console.error(chalk.red(`❌ Content directory not found: ${CONTENT_DIR}`));
    process.exit(1);
  }

  const files = fs.readdirSync(CONTENT_DIR).filter((file) => file.endsWith('.mdx'));

  if (filePattern) {
    const pattern = new RegExp(filePattern, 'i');
    return files.filter((file) => pattern.test(file));
  }

  return files;
}

// Create backup of original files
function createBackup(files: string[]) {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    console.log(chalk.green(`✓ Created backup directory: ${BACKUP_DIR}`));
  }

  for (const file of files) {
    const sourcePath = path.join(CONTENT_DIR, file);
    const backupPath = path.join(BACKUP_DIR, `${file}.backup-${Date.now()}`);
    fs.copyFileSync(sourcePath, backupPath);
  }

  console.log(chalk.green(`✓ Backed up ${files.length} files to ${BACKUP_DIR}`));
}

// Process a single guide file
async function processGuideFile(
  fileName: string,
  gearAugmentationService: GearAugmentationService,
  options: AugmentOptions,
): Promise<{ success: boolean; productsAdded: number; error?: string }> {
  try {
    const filePath = path.join(CONTENT_DIR, fileName);
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const { data: frontmatter, content } = matter(fileContent);

    console.log(chalk.blue(`Processing: ${fileName}`));

    // Check if already augmented (simple heuristic)
    if (content.includes('**Recommended ') && !options.dryRun) {
      console.log(chalk.yellow(`  ⚠️  Skipping - appears to already be augmented`));
      return { success: true, productsAdded: 0 };
    }

    // Augment the guide
    const result = await gearAugmentationService.augmentGuide(
      content,
      options.maxProductsPerGear || 3,
      options.similarityThreshold || 0.3,
    );

    if (result.totalProductsAdded === 0) {
      console.log(chalk.yellow(`  ⚠️  No products added - no gear found or no matching products`));
      return { success: true, productsAdded: 0 };
    }

    console.log(chalk.green(`  ✓ Found ${result.extractedGears.length} gear items`));
    console.log(chalk.green(`  ✓ Added ${result.totalProductsAdded} product links`));

    if (options.dryRun) {
      console.log(
        chalk.blue(`  📝 Dry run - would augment with ${result.totalProductsAdded} product links`),
      );

      // Show extracted gears for dry run
      for (const gearWithLinks of result.extractedGears) {
        if (gearWithLinks.products.length > 0) {
          console.log(
            chalk.cyan(
              `    - ${gearWithLinks.gear.item}: ${gearWithLinks.products.length} products`,
            ),
          );
        }
      }
    } else {
      // Write augmented content back to file
      const augmentedFileContent = matter.stringify(result.augmentedContent, frontmatter);
      fs.writeFileSync(filePath, augmentedFileContent);
      console.log(chalk.green(`  ✓ Updated ${fileName}`));
    }

    return { success: true, productsAdded: result.totalProductsAdded };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(chalk.red(`  ❌ Error processing ${fileName}: ${errorMessage}`));
    return { success: false, productsAdded: 0, error: errorMessage };
  }
}

// Main augmentation function
async function augmentGuides(options: AugmentOptions = {}) {
  console.log(chalk.blue('🚀 Starting guide augmentation...'));
  console.log(chalk.blue(`📁 Content directory: ${CONTENT_DIR}`));

  if (options.dryRun) {
    console.log(chalk.yellow('🏃 Running in DRY RUN mode - no files will be modified'));
  }

  // Validate environment
  validateEnvironment();

  // Get files to process
  const files = getGuideFiles(options.filePattern);
  console.log(chalk.blue(`📄 Found ${files.length} guide files to process`));

  if (files.length === 0) {
    console.log(chalk.yellow('No files to process. Exiting.'));
    return;
  }

  // Create backup unless skipped or dry run
  if (!options.dryRun && !options.skipBackup) {
    createBackup(files);
  }

  // Initialize augmentation service (use mock env for this script)
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    throw new Error('OPENAI_API_KEY is required');
  }

  const mockEnv = {
    OPENAI_API_KEY: openaiKey,
    AI_PROVIDER: (process.env.AI_PROVIDER || 'openai') as 'openai',
    CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID || '',
    CLOUDFLARE_AI_GATEWAY_ID: process.env.CLOUDFLARE_AI_GATEWAY_ID || '',
    AI: {}, // Mock Cloudflare AI binding
  };

  const gearAugmentationService = new GearAugmentationService(mockEnv, false);

  // Process files
  const results = {
    totalFiles: files.length,
    successful: 0,
    failed: 0,
    totalProductsAdded: 0,
    errors: [] as string[],
  };

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    assertDefined(file);

    console.log(chalk.blue(`\n[${i + 1}/${files.length}] Processing: ${file}`));

    const result = await processGuideFile(file, gearAugmentationService, options);

    if (result.success) {
      results.successful++;
      results.totalProductsAdded += result.productsAdded;
    } else {
      results.failed++;
      if (result.error) {
        results.errors.push(`${file}: ${result.error}`);
      }
    }

    // Add delay to avoid rate limiting
    if (i < files.length - 1) {
      console.log(chalk.gray('  ⏳ Waiting before next file...'));
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  // Print summary
  console.log(chalk.blue('\n📊 Augmentation Summary:'));
  console.log(
    chalk.green(`✅ Successfully processed: ${results.successful}/${results.totalFiles}`),
  );
  console.log(chalk.green(`🔗 Total product links added: ${results.totalProductsAdded}`));

  if (results.failed > 0) {
    console.log(chalk.red(`❌ Failed: ${results.failed}`));
    console.log(chalk.red('Errors:'));
    for (const error of results.errors) {
      console.log(chalk.red(`  - ${error}`));
    }
  }

  if (options.dryRun) {
    console.log(chalk.yellow('\n🏃 This was a dry run. No files were modified.'));
    console.log(chalk.yellow('Run without --dry-run to actually augment the files.'));
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);

  // Parse command line arguments
  const options: AugmentOptions = {
    dryRun: args.includes('--dry-run'),
    skipBackup: args.includes('--skip-backup'),
  };

  // Parse numeric options
  const maxProductsIndex = args.findIndex((arg) => arg === '--max-products');
  if (maxProductsIndex !== -1 && args[maxProductsIndex + 1]) {
    const nextArg = args[maxProductsIndex + 1];
    if (nextArg) {
      options.maxProductsPerGear = parseInt(nextArg, 10);
    }
  }

  const thresholdIndex = args.findIndex((arg) => arg === '--threshold');
  if (thresholdIndex !== -1 && args[thresholdIndex + 1]) {
    const nextArg = args[thresholdIndex + 1];
    if (nextArg) {
      options.similarityThreshold = parseFloat(nextArg);
    }
  }

  const patternIndex = args.findIndex((arg) => arg === '--pattern');
  if (patternIndex !== -1 && args[patternIndex + 1]) {
    options.filePattern = args[patternIndex + 1];
  }

  // Show help
  if (args.includes('--help') || args.includes('-h')) {
    console.log(chalk.blue('📖 Guide Augmentation Script'));
    console.log('\nUsage: bun run augment-existing-guides.ts [options]');
    console.log('\nOptions:');
    console.log('  --dry-run              Run without making any changes');
    console.log('  --skip-backup          Skip creating backup files');
    console.log('  --max-products <n>     Maximum products per gear item (default: 3)');
    console.log('  --threshold <n>        Similarity threshold 0-1 (default: 0.3)');
    console.log('  --pattern <regex>      Only process files matching pattern');
    console.log('  --help, -h             Show this help message');
    console.log('\nExamples:');
    console.log('  bun run augment-existing-guides.ts --dry-run');
    console.log('  bun run augment-existing-guides.ts --max-products 5 --threshold 0.4');
    console.log('  bun run augment-existing-guides.ts --pattern "backpack.*\\.mdx$"');
    return;
  }

  try {
    await augmentGuides(options);
  } catch (error) {
    console.error(chalk.red('❌ Augmentation failed:'), error);
    process.exit(1);
  }
}

// Run the script (following existing codebase pattern)
// eslint-disable-next-line @typescript-eslint/no-require-imports
if (require.main === module) {
  main().catch((error) => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });
}

export { augmentGuides };
