const result = await Bun.build({
	entrypoints: ["src/index.ts"],
	outdir: "dist",
	target: "node",
	minify: true,
	packages: "bundle",
});

if (!result.success) {
	console.error("Build failed:");
	for (const log of result.logs) {
		console.error(log);
	}
	process.exit(1);
}

// Prepend shebang
const outFile = Bun.file("dist/index.js");
const content = await outFile.text();
await Bun.write("dist/index.mjs", `#!/usr/bin/env node\n${content}`);

// Clean up intermediate file
const { unlink } = await import("node:fs/promises");
await unlink("dist/index.js").catch(() => {});

console.log("Built dist/index.mjs");
