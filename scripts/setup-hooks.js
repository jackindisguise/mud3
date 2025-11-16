#!/usr/bin/env node
/**
 * Writes a Git post-commit hook that invokes our Node checker.
 * Run once: `npm run setup:hooks`
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";

function getRepoRoot() {
	return execSync("git rev-parse --show-toplevel", { encoding: "utf-8" })
		.trim()
		.replace(/\r\n/g, "\n");
}

const root = getRepoRoot();
const hooksDir = join(root, ".git", "hooks");
mkdirSync(hooksDir, { recursive: true });
const hookPath = join(hooksDir, "post-commit");
const script = `#!/usr/bin/env bash
node "$(git rev-parse --show-toplevel)/scripts/post-commit.js"
`;
writeFileSync(hookPath, script, { encoding: "utf-8" });

try {
	execSync(`chmod +x "${hookPath}"`);
} catch {
	// Ignore chmod errors on Windows
}
console.log(`Installed post-commit hook -> ${hookPath}`);


