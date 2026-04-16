#!/usr/bin/env bun

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import semver from 'semver';

const releaseTag = process.argv[2];

if (!releaseTag) {
  console.error(
    '❌ Missing release tag. Usage: bun .github/scripts/validate-release-version.ts <tag> (e.g., v1.2.3)',
  );
  process.exit(1);
}

if (!releaseTag.startsWith('v')) {
  console.error(`❌ Tag '${releaseTag}' must follow v<semver> format (for example v2.0.20).`);
  process.exit(1);
}

const releaseVersion = semver.valid(releaseTag.slice(1));
if (!releaseVersion) {
  console.error(`❌ Tag '${releaseTag}' must follow v<semver> format (for example v2.0.20).`);
  process.exit(1);
}

const readJsonVersion = (path: string): string => {
  const json = JSON.parse(readFileSync(path, 'utf8')) as { version?: unknown };
  if (json.version === undefined) {
    throw new Error(`Missing version field in ${path}`);
  }
  if (typeof json.version !== 'string' || json.version.length === 0) {
    throw new Error(`Version must be a non-empty string in ${path}`);
  }
  if (!semver.valid(json.version)) {
    throw new Error(`Version must be valid semver in ${path}, got '${json.version}'`);
  }
  return json.version;
};

const readWorkspacePackageJsonPaths = (): string[] => {
  const rootPackageJson = JSON.parse(readFileSync('package.json', 'utf8')) as {
    workspaces?: unknown;
  };

  const workspacePatterns = Array.isArray(rootPackageJson.workspaces)
    ? rootPackageJson.workspaces
    : [];

  const paths = new Set<string>(['package.json']);

  for (const pattern of workspacePatterns) {
    if (typeof pattern !== 'string') continue;

    if (pattern.endsWith('/*')) {
      const basePath = pattern.slice(0, -2);
      const entries = readdirSync(basePath, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const packageJsonPath = `${basePath}/${entry.name}/package.json`;
        if (existsSync(packageJsonPath)) paths.add(packageJsonPath);
      }
      continue;
    }

    const packageJsonPath = `${pattern.replace(/\/+$/, '')}/package.json`;
    if (existsSync(packageJsonPath)) paths.add(packageJsonPath);
  }

  return [...paths].sort();
};

const readAppConfigVersion = (): string => {
  const appConfig = readFileSync('apps/expo/app.config.ts', 'utf8');
  const appConfigMatch = appConfig.match(/version:\s*(?:'([^']+)'|"([^"]+)"|`([^`]+)`)/);
  const version = appConfigMatch?.[1] ?? appConfigMatch?.[2] ?? appConfigMatch?.[3];
  if (!version) {
    throw new Error('Missing version field in apps/expo/app.config.ts');
  }
  if (!semver.valid(version)) {
    throw new Error(`Version must be valid semver in apps/expo/app.config.ts, got '${version}'`);
  }
  return version;
};

try {
  const packageJsonPaths = readWorkspacePackageJsonPaths();
  const monorepoPackageVersions = packageJsonPaths.map((path) => ({
    path,
    version: readJsonVersion(path),
  }));
  const appConfigVersion = readAppConfigVersion();

  const mismatches: string[] = [];
  for (const pkg of monorepoPackageVersions) {
    if (!semver.eq(pkg.version, releaseVersion)) {
      mismatches.push(`${pkg.path}=${pkg.version}`);
    }
  }
  if (!semver.eq(appConfigVersion, releaseVersion)) {
    mismatches.push(`apps/expo/app.config.ts=${appConfigVersion}`);
  }

  if (mismatches.length > 0) {
    console.error(
      `❌ Version mismatch for release ${releaseTag}. ` +
        `Expected all versions to match ${releaseVersion}, got ${mismatches.join(', ')}`,
    );
    process.exit(1);
  }

  console.log(`✓ Release tag and monorepo app versions match: ${releaseTag}`);
} catch (error) {
  console.error(`❌ ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
