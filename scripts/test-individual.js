#!/usr/bin/env node

/**
 * Test runner script that runs each test file independently.
 * This makes it easier to identify which specific test files are failing.
 */

import { fileURLToPath } from "url";
import { dirname, join, resolve } from "path";
import { readdir, stat } from "fs/promises";
import { existsSync } from "fs";
import { spawn } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, "..");

/**
 * Recursively find all test files in a directory
 */
async function findTestFiles(dir, pattern = /\.spec\.(ts|js)$/) {
	const files = [];
	try {
		const entries = await readdir(dir, { withFileTypes: true });
		for (const entry of entries) {
			const fullPath = join(dir, entry.name);
			if (entry.isDirectory()) {
				// Skip node_modules and dist directories
				if (
					entry.name !== "node_modules" &&
					entry.name !== "dist" &&
					entry.name !== ".git"
				) {
					files.push(...(await findTestFiles(fullPath, pattern)));
				}
			} else if (pattern.test(entry.name)) {
				files.push(fullPath);
			}
		}
	} catch (error) {
		// Ignore errors (e.g., permission denied)
	}
	return files;
}

/**
 * Run a single test file and return the result
 */
function runTestFile(filePath, useTypeScript = false) {
	return new Promise((resolve) => {
		const relativePath = filePath
			.replace(projectRoot + "\\", "")
			.replace(projectRoot + "/", "");

		let command, args;
		if (useTypeScript) {
			// Use tsx to run TypeScript directly
			command = "node";
			args = [
				"--import",
				"tsx/esm",
				"--test",
				"--test-reporter=spec",
				filePath,
			];
		} else {
			// Use compiled JavaScript
			command = "node";
			args = ["--test", "--test-reporter=spec", filePath];
		}

		const testProcess = spawn(command, args, {
			stdio: "pipe",
			shell: true,
			cwd: projectRoot,
		});

		let stdout = "";
		let stderr = "";

		testProcess.stdout.on("data", (data) => {
			stdout += data.toString();
		});

		testProcess.stderr.on("data", (data) => {
			stderr += data.toString();
		});

		testProcess.on("exit", (code) => {
			resolve({
				file: relativePath,
				success: code === 0,
				exitCode: code,
				stdout,
				stderr,
			});
		});
	});
}

/**
 * Main function
 */
async function main() {
	// Check if we should use TypeScript files or compiled JavaScript
	const useTypeScript =
		process.argv.includes("--ts") || process.argv.includes("-t");
	const sourceDir = useTypeScript
		? join(projectRoot, "src")
		: join(projectRoot, "dist", "src");

	if (useTypeScript && !existsSync(join(projectRoot, "node_modules", "tsx"))) {
		console.error(
			"Error: tsx is required to run TypeScript tests. Install it with: npm install --save-dev tsx"
		);
		process.exit(1);
	}

	console.log(`Finding test files in ${sourceDir}...`);
	const testFiles = await findTestFiles(sourceDir);

	if (testFiles.length === 0) {
		console.error(`No test files found in ${sourceDir}`);
		process.exit(1);
	}

	console.log(`Found ${testFiles.length} test file(s)\n`);
	console.log("=".repeat(80));

	const results = [];
	let passed = 0;
	let failed = 0;

	for (let i = 0; i < testFiles.length; i++) {
		const file = testFiles[i];
		const relativePath = file
			.replace(projectRoot + "\\", "")
			.replace(projectRoot + "/", "");

		console.log(`\n[${i + 1}/${testFiles.length}] Running: ${relativePath}`);
		console.log("-".repeat(80));

		const result = await runTestFile(file, useTypeScript);
		results.push(result);

		if (result.success) {
			passed++;
			console.log(`✓ PASSED: ${relativePath}`);
		} else {
			failed++;
			console.log(`✗ FAILED: ${relativePath} (exit code: ${result.exitCode})`);
			// Show stderr if there was an error
			if (result.stderr) {
				console.log("\nError output:");
				console.log(result.stderr);
			}
		}
	}

	// Summary
	console.log("\n" + "=".repeat(80));
	console.log("\nSUMMARY:");
	console.log(`Total: ${testFiles.length}`);
	console.log(`Passed: ${passed}`);
	console.log(`Failed: ${failed}`);

	if (failed > 0) {
		console.log("\nFailed test files:");
		results
			.filter((r) => !r.success)
			.forEach((r) => {
				console.log(`  - ${r.file}`);
			});
		process.exit(1);
	} else {
		console.log("\nAll tests passed! ✓");
		process.exit(0);
	}
}

main().catch((error) => {
	console.error("Error running tests:", error);
	process.exit(1);
});

