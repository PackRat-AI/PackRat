#!/usr/bin/env bun

import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { readFileSync, writeFileSync } from 'fs-extra';
import { glob } from 'glob';

const arg = process.argv[2];

if (!arg) {
  console.error(
    'Usage: bun bump [<newversion> | major | minor | patch | premajor | preminor | prepatch | prerelease]',
  );
  process.exit(1);
}

// Use bun pm version to bump the root package.json and get the new version
let newVersion: string;
try {
  // Bun pm version outputs the new version directly
  const output = execSync(`bun pm version ${arg}`, {
    encoding: 'utf-8',
  });
  // Extract version from output (it prints "v2.0.3" or similar)
  newVersion = output.trim().replace('v', '');
} catch (error: unknown) {
  console.error('Failed to bump version:', error instanceof Error ? error.message : error);
  console.error('Note: bun pm version requires a clean git working directory');
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

console.log(`\n✨ v${newVersion}`);
