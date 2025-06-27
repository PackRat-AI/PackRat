#!/usr/bin/env bun

import { $ } from "bun";
import { existsSync, readdirSync } from "fs";
import { join } from "path";

interface CleanResult {
  workspace: string;
  success: boolean;
  method: "script" | "fallback";
  error?: string;
}

const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
};

function log(message: string, color: keyof typeof colors = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function hasCleanScript(workspacePath: string): Promise<boolean> {
  try {
    const packageJsonPath = join(workspacePath, "package.json");
    if (!existsSync(packageJsonPath)) return false;

    const packageJson = await Bun.file(packageJsonPath).json();
    return packageJson.scripts?.clean !== undefined;
  } catch {
    return false;
  }
}

async function cleanWorkspace(
  workspacePath: string,
  workspaceName: string
): Promise<CleanResult> {
  log(`\nCleaning ${workspaceName}...`, "cyan");

  if (await hasCleanScript(workspacePath)) {
    try {
      await $`cd ${workspacePath} && bun run clean`.quiet();
      log(`✓ ${workspaceName} cleaned successfully`, "green");
      return { workspace: workspaceName, success: true, method: "script" };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      log(`✗ Failed to clean ${workspaceName}: ${errorMessage}`, "red");
      return {
        workspace: workspaceName,
        success: false,
        method: "script",
        error: errorMessage,
      };
    }
  } else {
    log(`  No clean script found, using fallback cleaning...`, "yellow");
    const itemsToClean = [
      "node_modules",
      ".next",
      ".expo",
      "out",
      ".vercel",
      "dist",
      "build",
      ".wrangler",
      ".turbo",
    ];

    let hasCleanedSomething = false;
    for (const item of itemsToClean) {
      const itemPath = join(workspacePath, item);
      if (existsSync(itemPath)) {
        try {
          await $`bunx rimraf ${itemPath}`.quiet();
          log(`  ✓ Removed ${item}`, "green");
          hasCleanedSomething = true;
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          log(`  ✗ Failed to remove ${item}: ${errorMessage}`, "red");
        }
      }
    }

    return {
      workspace: workspaceName,
      success: true,
      method: "fallback",
    };
  }
}

async function getWorkspaces(dir: string): Promise<string[]> {
  try {
    if (!existsSync(dir)) return [];

    return readdirSync(dir)
      .filter((name) => {
        const workspacePath = join(dir, name);
        return (
          existsSync(workspacePath) &&
          existsSync(join(workspacePath, "package.json"))
        );
      })
      .map((name) => join(dir, name));
  } catch {
    return [];
  }
}

async function main() {
  log("🧹 Starting clean process...", "bright");

  const rootPath = process.cwd();
  const results: CleanResult[] = [];

  // Clean apps
  const apps = await getWorkspaces(join(rootPath, "apps"));
  log(`\nFound ${apps.length} apps to clean`, "cyan");
  for (const appPath of apps) {
    const appName = `apps/${appPath.split("/").pop()}`;
    results.push(await cleanWorkspace(appPath, appName));
  }

  // Clean packages
  const packages = await getWorkspaces(join(rootPath, "packages"));
  log(`\nFound ${packages.length} packages to clean`, "cyan");
  for (const packagePath of packages) {
    const packageName = `packages/${packagePath.split("/").pop()}`;
    results.push(await cleanWorkspace(packagePath, packageName));
  }

  // Clean root
  log("\nCleaning root directory...", "cyan");
  try {
    await $`bunx rimraf node_modules`.quiet();
    log("✓ Root cleaned successfully", "green");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`✗ Failed to clean root: ${errorMessage}`, "red");
  }

  // Summary
  const successful = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;
  const byMethod = results.reduce(
    (acc, r) => {
      if (r.success) acc[r.method]++;
      return acc;
    },
    { script: 0, fallback: 0 }
  );

  log(`\n${"=".repeat(50)}`, "bright");
  log("Clean complete! ✨", "bright");
  log(`Cleaned: ${successful} workspaces`, "green");
  log(`  - ${byMethod.script} using clean scripts`, "cyan");
  log(`  - ${byMethod.fallback} using fallback method`, "cyan");
  if (failed > 0) {
    log(`Failed: ${failed} workspaces`, "red");
  }
}

// Run the script
await main();
