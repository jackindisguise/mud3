#!/usr/bin/env node

/**
 * Test runner script that runs TypeScript test files directly using tsx loader.
 * This allows test failures to reference TypeScript source lines instead of compiled JavaScript.
 */

import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { spawn } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, "..");

let reporter = "spec";

// Check npm config for reporter (fallback for when arguments aren't passed through)
if (process.env.npm_config_spec) reporter = "spec";
else if (process.env.npm_config_dot) reporter = "dot";
else if (process.env.npm_config_tap) reporter = "tap";
else if (process.env.npm_config_nyan) reporter = "nyan";
else if (process.env.npm_config_bdd) reporter = "bdd";
else if (process.env.npm_config_min) reporter = "min";
else if (process.env.npm_config_progress) reporter = "progress";
else if (process.env.npm_config_list) reporter = "list";

// Get test file arguments
const args = process.argv.slice(2);
const testFiles = args.length > 0 ? args : ['"src/**/*.spec.ts"'];

// Run tests using Node with tsx import hook to execute TypeScript files directly
// This allows error messages to reference TypeScript source lines instead of compiled JavaScript
const testProcess = spawn(
	"node",
	[
		"--import",
		"tsx/esm",
		"--test",
		`--test-reporter=${reporter}`,
		...testFiles,
	],
	{
		stdio: "inherit",
		shell: true,
		cwd: projectRoot,
	}
);

testProcess.on("exit", (code) => {
	process.exit(code || 0);
});
