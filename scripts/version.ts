/**
 * Bump the version across all package.json files in the monorepo.
 *
 * Usage:
 *   bun run version patch
 *   bun run version minor
 *   bun run version major
 *   bun run version 1.2.3
 */

const PACKAGE_PATHS = [
	"package.json",
	"packages/shared/package.json",
	"packages/cli/package.json",
	"packages/api/package.json",
];

function bumpVersion(current: string, bump: string): string {
	const semverRegex = /^\d+\.\d+\.\d+$/;
	if (semverRegex.test(bump)) return bump;

	const [major, minor, patch] = current.split(".").map(Number);

	switch (bump) {
		case "patch":
			return `${major}.${minor}.${patch + 1}`;
		case "minor":
			return `${major}.${minor + 1}.0`;
		case "major":
			return `${major + 1}.0.0`;
		default:
			console.error(`Invalid bump type: ${bump}`);
			console.error("Usage: bun run version <patch|minor|major|x.y.z>");
			process.exit(1);
	}
}

const bump = process.argv[2];
if (!bump) {
	console.error("Usage: bun run version <patch|minor|major|x.y.z>");
	process.exit(1);
}

const rootPkg = await Bun.file(PACKAGE_PATHS[0]).json();
const currentVersion: string = rootPkg.version;
const nextVersion = bumpVersion(currentVersion, bump);

console.log(`${currentVersion} → ${nextVersion}\n`);

for (const path of PACKAGE_PATHS) {
	const file = Bun.file(path);
	const pkg = await file.json();
	pkg.version = nextVersion;
	await Bun.write(file, `${JSON.stringify(pkg, null, "\t")}\n`);
	console.log(`  updated ${path}`);
}

console.log(
	`\nRun:\n  git add -A && git commit -m "🔖 v${nextVersion}" && git tag v${nextVersion}`,
);
