import chalk from 'chalk';
import fs from 'fs';
import matter from 'gray-matter';
import path from 'path';
import { type ContentEnhancementOptions, enhanceGuideContent } from '../lib/enhanceGuideContent';

// Configuration
const CONTENT_DIR = path.join(process.cwd(), 'content/posts');
const BACKUP_DIR = path.join(process.cwd(), 'content/backups');

interface EnhancementStats {
  processed: number;
  enhanced: number;
  skipped: number;
  errors: number;
  totalProducts: number;
}

interface CliOptions {
  dryRun: boolean;
  backup: boolean;
  pattern?: string;
  maxFiles?: number;
  apiUrl?: string;
  verbose: boolean;
  filePaths?: string[];
}

/**
 * Ensure backup directory exists
 */
function ensureBackupDir(): void {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    console.log(chalk.green(`✓ Created backup directory: ${BACKUP_DIR}`));
  }
}

/**
 * Create backup of a file
 */
function createBackup(filePath: string): string {
  const fileName = path.basename(filePath);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(BACKUP_DIR, `${timestamp}-${fileName}`);

  fs.copyFileSync(filePath, backupPath);
  return backupPath;
}

/**
 * Validate and resolve file paths
 */
function getFilesByPaths(filePaths: string[]): string[] {
  const resolvedFiles: string[] = [];

  for (const filePath of filePaths) {
    let resolvedPath: string;

    // Handle relative paths
    if (path.isAbsolute(filePath)) {
      resolvedPath = filePath;
    } else {
      // Check if it's relative to current directory first
      if (fs.existsSync(filePath)) {
        resolvedPath = path.resolve(filePath);
      } else {
        // Try relative to content directory
        resolvedPath = path.join(CONTENT_DIR, filePath);
      }
    }

    // Validate file exists
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`File not found: ${filePath} (resolved to: ${resolvedPath})`);
    }

    // Validate it's an MDX file
    if (!resolvedPath.endsWith('.mdx')) {
      throw new Error(`File must be an MDX file: ${filePath}`);
    }

    // Validate it's a file (not directory)
    const stat = fs.statSync(resolvedPath);
    if (!stat.isFile()) {
      throw new Error(`Path is not a file: ${filePath}`);
    }

    resolvedFiles.push(resolvedPath);
  }

  return resolvedFiles;
}

/**
 * Get all MDX files in the content directory
 */
function getContentFiles(pattern?: string): string[] {
  if (!fs.existsSync(CONTENT_DIR)) {
    throw new Error(`Content directory not found: ${CONTENT_DIR}`);
  }

  const files = fs
    .readdirSync(CONTENT_DIR)
    .filter((file) => file.endsWith('.mdx'))
    .map((file) => path.join(CONTENT_DIR, file));

  if (pattern) {
    // Escape special regex characters to prevent regex injection
    const escapedPattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedPattern, 'i');
    return files.filter((file) => regex.test(path.basename(file)));
  }

  return files;
}

/**
 * Parse frontmatter and content from MDX file
 */
function parseContentFile(filePath: string): {
  metadata: Record<string, unknown>;
  content: string;
  originalContent: string;
} {
  const fileContent = fs.readFileSync(filePath, 'utf8');
  const { data: metadata, content } = matter(fileContent);

  return {
    metadata,
    content,
    originalContent: fileContent,
  };
}

/**
 * Write enhanced content back to file
 */
function writeEnhancedContent(
  filePath: string,
  metadata: Record<string, unknown>,
  enhancedContent: string,
): void {
  const newFileContent = matter.stringify(enhancedContent, metadata);
  fs.writeFileSync(filePath, newFileContent, 'utf8');
}

/**
 * Enhance a single content file
 */
async function enhanceFile(
  filePath: string,
  options: CliOptions,
  enhancementOptions: ContentEnhancementOptions,
): Promise<{
  enhanced: boolean;
  productsAdded: number;
  error?: string;
}> {
  try {
    const fileName = path.basename(filePath);

    if (options.verbose) {
      console.log(chalk.blue(`Processing: ${fileName}`));
    }

    // Parse the file
    const { metadata, content } = parseContentFile(filePath);

    // Skip if content is too short to enhance meaningfully
    if (content.length < 500) {
      if (options.verbose) {
        console.log(chalk.yellow(`  ⏭️  Skipping ${fileName} (content too short)`));
      }
      return { enhanced: false, productsAdded: 0 };
    }

    console.log(chalk.blue(`🔄 Enhancing: ${fileName}`));

    // Enhance the content
    const result = await enhanceGuideContent(content, enhancementOptions);

    // Check if enhancement actually added value
    if (result.productsUsed.length === 0) {
      if (options.verbose) {
        console.log(chalk.yellow(`  ℹ️  No relevant products found for ${fileName}`));
      }
      return { enhanced: false, productsAdded: 0 };
    }

    if (options.dryRun) {
      console.log(
        chalk.cyan(
          `  🔍 [DRY RUN] Would enhance ${fileName} with ${result.productsUsed.length} products:`,
        ),
      );
      result.productsUsed.forEach((product) => {
        console.log(chalk.cyan(`    - ${product.name} (${product.context})`));
      });
      return { enhanced: true, productsAdded: result.productsUsed.length };
    }

    // Create backup if requested
    if (options.backup) {
      const backupPath = createBackup(filePath);
      if (options.verbose) {
        console.log(chalk.gray(`  📁 Backup created: ${path.basename(backupPath)}`));
      }
    }

    // Write enhanced content
    writeEnhancedContent(filePath, metadata, result.content);

    console.log(
      chalk.green(`  ✅ Enhanced ${fileName} with ${result.productsUsed.length} product links`),
    );

    if (options.verbose) {
      result.productsUsed.forEach((product) => {
        console.log(chalk.gray(`    - ${product.name}`));
      });
    }

    return { enhanced: true, productsAdded: result.productsUsed.length };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(chalk.red(`  ❌ Error enhancing ${path.basename(filePath)}: ${errorMessage}`));
    return { enhanced: false, productsAdded: 0, error: errorMessage };
  }
}

/**
 * Main enhancement function
 */
async function enhanceContent(cliOptions: CliOptions): Promise<void> {
  console.log(chalk.blue('🚀 Starting content enhancement...'));

  const enhancementOptions: ContentEnhancementOptions = {
    apiBaseUrl: cliOptions.apiUrl || 'http://localhost:8787',
    temperature: 0.3,
    maxSearchResults: 5,
  };

  // Get content files - use file paths if provided, otherwise use pattern-based discovery
  let contentFiles: string[];

  if (cliOptions.filePaths && cliOptions.filePaths.length > 0) {
    contentFiles = getFilesByPaths(cliOptions.filePaths);
    console.log(chalk.blue(`📄 Processing ${contentFiles.length} specified files`));
  } else {
    contentFiles = getContentFiles(cliOptions.pattern);
    console.log(chalk.blue(`📄 Found ${contentFiles.length} content files`));
  }

  const filesToProcess = cliOptions.maxFiles
    ? contentFiles.slice(0, cliOptions.maxFiles)
    : contentFiles;

  if (cliOptions.maxFiles && contentFiles.length > cliOptions.maxFiles) {
    console.log(chalk.yellow(`⚠️  Processing first ${cliOptions.maxFiles} files only`));
  }

  if (cliOptions.dryRun) {
    console.log(chalk.cyan('🔍 DRY RUN MODE - No files will be modified'));
  } else if (cliOptions.backup) {
    ensureBackupDir();
  }

  // Enhancement statistics
  const stats: EnhancementStats = {
    processed: 0,
    enhanced: 0,
    skipped: 0,
    errors: 0,
    totalProducts: 0,
  };

  // Process files
  for (const filePath of filesToProcess) {
    stats.processed++;

    const result = await enhanceFile(filePath, cliOptions, enhancementOptions);

    if (result.error) {
      stats.errors++;
    } else if (result.enhanced) {
      stats.enhanced++;
      stats.totalProducts += result.productsAdded;
    } else {
      stats.skipped++;
    }

    // Add delay between files to avoid rate limiting
    if (stats.processed < filesToProcess.length) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }

  // Print final statistics
  console.log(chalk.blue('\n📊 Enhancement Summary:'));
  console.log(`${chalk.green('✅ Enhanced:')} ${stats.enhanced} files`);
  console.log(`${chalk.yellow('⏭️  Skipped:')} ${stats.skipped} files`);
  console.log(`${chalk.red('❌ Errors:')} ${stats.errors} files`);
  console.log(`${chalk.blue('🔗 Total products added:')} ${stats.totalProducts}`);

  if (stats.enhanced > 0) {
    const avgProducts = (stats.totalProducts / stats.enhanced).toFixed(1);
    console.log(`${chalk.gray('📈 Average products per enhanced file:')} ${avgProducts}`);
  }

  if (cliOptions.dryRun) {
    console.log(chalk.cyan('\n🔍 This was a dry run. To apply changes, run without --dry-run'));
  } else if (stats.enhanced > 0) {
    console.log(chalk.green('\n🎉 Content enhancement completed successfully!'));
  }
}

/**
 * Parse command line arguments
 */
function parseArgs(): CliOptions {
  const args = process.argv.slice(2);

  const options: CliOptions = {
    dryRun: false,
    backup: true,
    verbose: false,
    filePaths: [],
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--dry-run':
      case '-d':
        options.dryRun = true;
        break;
      case '--no-backup':
        options.backup = false;
        break;
      case '--pattern':
      case '-p':
        options.pattern = args[++i];
        break;
      case '--max-files':
      case '-n':
        options.maxFiles = Number.parseInt(args[++i] || '0') || undefined;
        break;
      case '--api-url':
      case '-u':
        options.apiUrl = args[++i];
        break;
      case '--verbose':
      case '-v':
        options.verbose = true;
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
        break;
      default:
        // Treat any non-option argument as a file path
        if (!arg.startsWith('-')) {
          if (!options.filePaths) options.filePaths = [];
          options.filePaths.push(arg);
        } else {
          console.error(chalk.red(`Unknown option: ${arg}`));
          printHelp();
          process.exit(1);
        }
        break;
    }
  }

  return options;
}

/**
 * Print help information
 */
function printHelp(): void {
  console.log(`
${chalk.blue('PackRat Content Enhancement Tool')}

Enhance existing guide content by intelligently integrating relevant catalog items.

${chalk.yellow('Usage:')}
  bun run enhance-content [file1.mdx file2.mdx ...] [options]
  bun run enhance-content [options]

${chalk.yellow('Arguments:')}
  file1.mdx file2.mdx    Direct file paths to enhance (default mode)
                         Can be absolute paths, relative paths, or filenames in content/posts/

${chalk.yellow('Options:')}
  -d, --dry-run          Preview changes without modifying files
  -p, --pattern <regex>  Only process files matching pattern (legacy mode)
  -n, --max-files <num>  Limit number of files to process
  -u, --api-url <url>    Catalog API base URL (default: http://localhost:8787)
  -v, --verbose          Enable verbose output
      --no-backup        Skip creating backup files
  -h, --help             Show this help message

${chalk.yellow('Examples:')}
  # Process specific files (recommended)
  bun run enhance-content hiking-guide.mdx backpacking-tips.mdx --dry-run
  bun run enhance-content content/posts/my-guide.mdx --verbose
  
  # Legacy pattern-based processing
  bun run enhance-content --pattern "hiking|backpacking" --max-files 5
  bun run enhance-content --dry-run  # processes all files
  
${chalk.gray('Note: Ensure the PackRat API is running before using this tool.')}
`);
}

// Command line interface
if (require.main === module) {
  const options = parseArgs();

  enhanceContent(options).catch((error) => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });
}
