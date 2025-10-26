import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);

/**
 * Test the enhanced CLI functionality for file path support
 */
async function testFilePathCLI(): Promise<void> {
  console.log(chalk.blue('🧪 Testing File Path CLI Enhancement'));
  console.log(chalk.gray('═'.repeat(50)));

  const CONTENT_DIR = path.join(process.cwd(), 'content/posts');

  // Get some test files
  const testFiles = fs
    .readdirSync(CONTENT_DIR)
    .filter((file) => file.endsWith('.mdx'))
    .slice(0, 2); // Just test with 2 files

  if (testFiles.length === 0) {
    console.error(chalk.red('❌ No test files found in content/posts'));
    process.exit(1);
  }

  const tests = [
    {
      name: 'Single file by name',
      command: `bun run enhance-content ${testFiles[0]} --dry-run`,
      expectedFiles: 1,
    },
    {
      name: 'Multiple files by name',
      command: `bun run enhance-content ${testFiles[0]} ${testFiles[1]} --dry-run`,
      expectedFiles: 2,
    },
    {
      name: 'Single file with full path',
      command: `bun run enhance-content content/posts/${testFiles[0]} --dry-run`,
      expectedFiles: 1,
    },
    {
      name: 'Legacy pattern mode',
      command: `bun run enhance-content --pattern "${testFiles[0].substring(0, 5)}" --dry-run --max-files 1`,
      expectedFiles: 1,
    },
    {
      name: 'Error handling - non-existent file',
      command: 'bun run enhance-content non-existent-file.mdx --dry-run',
      shouldError: true,
    },
    {
      name: 'Error handling - non-MDX file',
      command: 'bun run enhance-content package.json --dry-run',
      shouldError: true,
    },
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    console.log(chalk.blue(`\n🔍 Testing: ${test.name}`));
    console.log(chalk.gray(`Command: ${test.command}`));

    try {
      const { stdout } = await execAsync(test.command);

      if (test.shouldError) {
        console.log(chalk.red(`  ❌ Expected error but command succeeded`));
        failed++;
        continue;
      }

      // Check if the expected number of files were processed
      if (test.expectedFiles) {
        const match = stdout.match(/📄 (?:Processing|Found) (\d+) (?:specified |content )?files/);
        const processedFiles = match ? parseInt(match[1]) : 0;

        if (processedFiles === test.expectedFiles) {
          console.log(chalk.green(`  ✅ Processed ${processedFiles} files as expected`));
          passed++;
        } else {
          console.log(
            chalk.red(`  ❌ Expected ${test.expectedFiles} files, got ${processedFiles}`),
          );
          failed++;
        }
      } else {
        console.log(chalk.green(`  ✅ Command executed successfully`));
        passed++;
      }
    } catch (error: unknown) {
      if (test.shouldError) {
        // Check if it's the right kind of error
        const errorMessage =
          (error as any).stderr ||
          (error as any).stdout ||
          (error as Error).message ||
          'Unknown error';
        if (
          errorMessage.includes('File not found') ||
          errorMessage.includes('File must be an MDX file')
        ) {
          console.log(chalk.green(`  ✅ Got expected error: ${errorMessage.split('\n')[0]}`));
          passed++;
        } else {
          console.log(chalk.red(`  ❌ Got unexpected error: ${errorMessage.split('\n')[0]}`));
          failed++;
        }
      } else {
        const unexpectedErrorMessage =
          (error as any).stderr || (error as Error).message || 'Unknown error';
        console.log(chalk.red(`  ❌ Unexpected error: ${unexpectedErrorMessage.split('\n')[0]}`));
        failed++;
      }
    }
  }

  // Summary
  console.log(chalk.blue('\n📊 Test Summary:'));
  console.log(`${chalk.green('✅ Passed:')} ${passed}`);
  console.log(`${chalk.red('❌ Failed:')} ${failed}`);

  if (failed === 0) {
    console.log(chalk.green('\n🎉 All tests passed! CLI enhancement is working correctly.'));
  } else {
    console.log(chalk.red('\n💥 Some tests failed. Please review the implementation.'));
    process.exit(1);
  }
}

// Run the tests
if (require.main === module) {
  testFilePathCLI().catch((error) => {
    console.error(chalk.red('Fatal test error:'), error);
    process.exit(1);
  });
}
