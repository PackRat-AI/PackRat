#!/usr/bin/env bun

import { join } from 'node:path';
import { $ } from 'bun';
import { readFileSync, writeFileSync } from 'fs-extra';
import { glob } from 'glob';

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

const RE_VERSION_FIELD = /"version":\s*"[^"]*"/;

// Update all package.json files
for (const file of packageFiles) {
  try {
    const content = readFileSync(file, 'utf-8');
    const updated = content.replace(RE_VERSION_FIELD, `"version": "${newVersion}"`);
    writeFileSync(file, updated);
    console.log(`✅ Updated ${file}`);
  } catch (error) {
    console.error(`❌ Failed to update ${file}:`, error);
  }
}

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

// Update the Swift project's MARKETING_VERSION for every target (iOS, macOS,
// watchOS). The Swift app ships to the same App Store record as the Expo build,
// so its marketing version must track the monorepo version — otherwise the next
// TestFlight upload collides with an already-released version.
const swiftProjectPath = join(process.cwd(), 'apps/swift/project.yml');
const RE_MARKETING_VERSION = /MARKETING_VERSION:\s*"[^"]*"/g;
try {
  const content = readFileSync(swiftProjectPath, 'utf-8');
  const matches = content.match(RE_MARKETING_VERSION)?.length ?? 0;
  if (matches === 0) {
    console.error(
      `❌ No MARKETING_VERSION entries found in ${swiftProjectPath}; Swift version NOT bumped. Update it by hand before uploading to TestFlight.`,
    );
  } else {
    const updated = content.replace(RE_MARKETING_VERSION, `MARKETING_VERSION: "${newVersion}"`);
    writeFileSync(swiftProjectPath, updated);
    console.log(`✅ Updated ${swiftProjectPath} (${matches} target(s))`);
  }
} catch (error) {
  console.error(`❌ Failed to update project.yml:`, error);
}

// Update the MCP server's advertised version. `ServiceMeta.Version` mirrors
// packages/mcp/package.json by hand and is asserted to match it in
// constants.test.ts, so a bump that skipped this file left the repo on a
// version the test suite rejects — which is exactly how it drifted to 2.2.0
// while the monorepo moved to 2.2.3.
const mcpConstantsPath = join(process.cwd(), 'packages/mcp/src/constants.ts');
const RE_SERVICE_META_VERSION = /(ServiceMeta[\s\S]*?Version:\s*)'[^']*'/;
try {
  const content = readFileSync(mcpConstantsPath, 'utf-8');
  if (!RE_SERVICE_META_VERSION.test(content)) {
    console.error(
      `❌ No ServiceMeta.Version found in ${mcpConstantsPath}; MCP version NOT bumped. constants.test.ts will fail until it matches package.json.`,
    );
  } else {
    const updated = content.replace(RE_SERVICE_META_VERSION, `$1'${newVersion}'`);
    writeFileSync(mcpConstantsPath, updated);
    console.log(`✅ Updated ${mcpConstantsPath}`);
  }
} catch (error) {
  console.error(`❌ Failed to update constants.ts:`, error);
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
