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

// Use npm version to bump the root package.json and get the new version
let newVersion: string;
try {
  const output = execSync(`npm version ${arg} --no-git-tag-version`, {
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'ignore'], // Suppress npm's stderr output
  });
  newVersion = output.trim().replace('v', '');
} catch (_error) {
  console.error('Failed to bump version. Make sure you provide a valid version argument.');
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
