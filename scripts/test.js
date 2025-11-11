#!/usr/bin/env node

/**
 * Test runner script that converts TypeScript test file paths to compiled JavaScript paths.
 * Filters out TypeScript files and only passes JavaScript files to the test runner.
 */

import { fileURLToPath } from "url";
import { dirname, join, relative, resolve } from "path";
import { existsSync } from "fs";
import { inspect } from "node:util";

// Configure inspect defaults for cleaner test output
if (typeof inspect.defaultOptions !== "undefined") {
	inspect.defaultOptions.depth = 2;
	inspect.defaultOptions.maxArrayLength = 5;
	inspect.defaultOptions.maxStringLength = 80;
	inspect.defaultOptions.compact = true;
	inspect.defaultOptions.showHidden = false;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, "..");

// Get all arguments after the script name
const args = process.argv.slice(2);

// Filter and convert test file paths
const testFiles = args
	.map((arg) => {
		// If it's a TypeScript file, convert to JavaScript
		if (arg.endsWith(".spec.ts") || arg.endsWith(".test.ts")) {
			// Convert src/path/to/file.spec.ts to dist/path/to/file.spec.js
			const jsPath = arg.replace(/^src\//, "dist/src/").replace(/\.ts$/, ".js");
			const fullPath = join(projectRoot, jsPath);
			if (existsSync(fullPath)) {
				return jsPath;
			}
			// If the compiled file doesn't exist, return null to filter it out
			return null;
		}
		// If it's already a JavaScript file or a pattern, pass it through
		if (arg.endsWith(".js") || arg.includes("*")) {
			return arg;
		}
		// Filter out TypeScript files that don't have a compiled version
		return null;
	})
	.filter((file) => file !== null);

// If no specific files were provided or all were filtered out, use the default pattern
const testArgs = testFiles.length > 0 ? testFiles : ['"dist/**/*.spec.js"'];

// Run the test command
import { spawn } from "child_process";

const testProcess = spawn(
	"node",
	["--test", "--test-reporter=dot", ...testArgs],
	{
		stdio: "inherit",
		shell: true,
	}
);

testProcess.on("exit", (code) => {
	process.exit(code || 0);
});
