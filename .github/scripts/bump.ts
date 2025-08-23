#!/usr/bin/env bun

import { $ } from 'bun';
import { readFileSync, writeFileSync } from 'fs-extra';
import { glob } from 'glob';
import { join } from 'node:path';

const arg = process.argv[2];

if (!arg) {
  console.error(
    'Usage: bun bump [<newversion> | major | minor | patch | premajor | preminor | prepatch | prerelease]',
  );
  process.exit(1);
}

// Ensure clean git working directory
try {
  const result = await $`git status --porcelain`;
  if (result.stdout.toString().trim()) {
    console.error('❌ Working directory not clean. Commit or stash your changes first.');
    process.exit(1);
  }
} catch (error) {
  console.error('❌ Failed to check git status:', error);
  process.exit(1);
}

// Use bun pm version to bump the root package.json and get the new version
let newVersion: string;
try {
  const result = await $`bun pm version ${arg} --no-git-tag-version`;
  // Extract version from output (it prints "v2.0.3" or similar)
  newVersion = result.stdout.toString().trim().replace(/^v/, '');
} catch (error: unknown) {
  console.error('❌ Failed to bump version:', error instanceof Error ? error.message : error);
  process.exit(1);
}

console.log(`Setting version: ${newVersion}`);

// Find all package.json files (excluding node_modules and root)
const packageFiles = glob.sync('**/package.json', {
  ignore: ['**/node_modules/**', '**/dist/**', '**/.next/**', 'package.json'],
});

// Update all package.json files
packageFiles.forEach((file) => {
  try {
    const content = readFileSync(file, 'utf-8');
    const updated = content.replace(/"version":\s*"[^"]*"/, `"version": "${newVersion}"`);
    writeFileSync(file, updated);
    console.log(`✅ Updated ${file}`);
  } catch (error) {
    console.error(`❌ Failed to update ${file}:`, error);
  }
});

// Update app.config.ts
const appConfigPath = join(process.cwd(), 'apps/expo/app.config.ts');
try {
  const content = readFileSync(appConfigPath, 'utf-8');
  const updated = content.replace(/version:\s*['"][^'"]*['"]/, `version: '${newVersion}'`);
  writeFileSync(appConfigPath, updated);
  console.log(`✅ Updated ${appConfigPath}`);
} catch (error) {
  console.error(`❌ Failed to update app.config.ts:`, error);
}

// Commit and tag as last step
try {
  await $`git add .`;
  await $`git commit -m "chore: bump version to v${newVersion}"`;
  await $`git tag v${newVersion}`;
  console.log(`✅ Created commit and tag v${newVersion}`);
} catch (error) {
  console.error('❌ Failed to commit or tag:', error);
}

console.log(`\n✨ Version bumped to v${newVersion}`);
console.log(`👉 Next steps:`);
console.log(`   git push`);
console.log(`   git push --tags`);
