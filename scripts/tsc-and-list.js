#!/usr/bin/env node

/**
 * Lists source files that were compiled in this run of tsc.
 * Uses --listEmittedFiles to show only files that were actually emitted.
 */

import { exec } from "child_process";
import { promisify } from "util";
import chalk from "chalk";
import { fileURLToPath } from "url";
import { dirname, relative, join } from "path";
import { existsSync } from "fs";

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = dirname(__dirname);

/**
 * Convert an emitted file path to its source file path
 */
function emittedToSourcePath(emittedPath) {
	const normalized = emittedPath.replace(/\\/g, "/");

	// Remove dist/ prefix
	let pathWithoutDist = normalized;
	if (normalized.includes("/dist/")) {
		pathWithoutDist = normalized.split("/dist/")[1];
	} else if (normalized.includes("\\dist\\")) {
		pathWithoutDist = normalized.split("\\dist\\")[1].replace(/\\/g, "/");
	} else if (normalized.startsWith("dist/")) {
		pathWithoutDist = normalized.slice(5);
	}

	// Convert extensions back to source
	let sourcePath = pathWithoutDist;

	// Handle declaration files first (they come from the same source)
	if (sourcePath.endsWith(".d.cjs")) {
		sourcePath = sourcePath.replace(/\.d\.cjs$/, ".cts");
	} else if (sourcePath.endsWith(".d.mjs")) {
		sourcePath = sourcePath.replace(/\.d\.mjs$/, ".mts");
	} else if (sourcePath.endsWith(".d.ts")) {
		sourcePath = sourcePath.replace(/\.d\.ts$/, ".ts");
	} else if (sourcePath.endsWith(".cjs")) {
		sourcePath = sourcePath.replace(/\.cjs$/, ".cts");
	} else if (sourcePath.endsWith(".mjs")) {
		sourcePath = sourcePath.replace(/\.mjs$/, ".mts");
	} else if (sourcePath.endsWith(".js")) {
		sourcePath = sourcePath.replace(/\.js$/, ".ts");
	}

	// Check if source file exists (could be in src/ or root)
	const srcPath = join(projectRoot, "src", sourcePath);
	const rootPath = join(projectRoot, sourcePath);

	if (existsSync(srcPath)) {
		return relative(projectRoot, srcPath);
	} else if (existsSync(rootPath)) {
		return relative(projectRoot, rootPath);
	}

	// Fallback: return the converted path anyway
	return sourcePath;
}

/**
 * Format and display TypeScript errors with pretty formatting
 */
function formatAndDisplayErrors(errorOutput) {
	// Filter out TSFILE lines (build info)
	const errorLines = errorOutput
		.split("\n")
		.filter((line) => !line.includes("TSFILE:") && line.trim());

	console.error(chalk.red.bold("\nTypeScript errors:\n"));

	// Parse error lines - format: file:line:column - error TS####: message
	for (let i = 0; i < errorLines.length; i++) {
		const line = errorLines[i];

		// Check if this is an error line with file:line:column
		// Format 1: file:line:column - error TS####: message
		// Format 2: file(line,column): error TS####: message (with optional leading whitespace)
		let errorMatch = line.match(
			/^\s*(.+?):(\d+):(\d+)\s*-\s*error\s+(TS\d+):\s*(.+)$/
		);
		if (!errorMatch) {
			// Try format with parentheses
			errorMatch = line.match(
				/^\s*(.+?)\((\d+),(\d+)\):\s*error\s+(TS\d+):\s*(.+)$/
			);
		}
		if (errorMatch) {
			const [, file, lineNum, col, errorCode, message] = errorMatch;
			// Display file:line:column in red bold with X
			console.error(chalk.red.bold(`✗ ${file}:${lineNum}:${col}`));
			// Display error code and message indented
			console.error(chalk.red(`  error ${chalk.bold(errorCode)}: ${message}`));
			continue;
		}

		// Check if this is a code snippet line (starts with line number)
		if (/^\s*\d+\s+\|/.test(line) || /^\s*\d+\s+/.test(line)) {
			console.error(chalk.gray(`  ${line}`));
			continue;
		}

		// Check if this is an underline line (tildes or carets)
		if (/^[\s~^]+$/.test(line)) {
			console.error(chalk.gray(`  ${line}`));
			continue;
		}

		// Check if this is the "Found X error" summary
		if (line.match(/^Found \d+ error/)) {
			console.error(chalk.red.bold(`\n${line}`));
			continue;
		}

		// Other lines (blank lines, etc.) - skip or show as-is
		if (line.trim() === "") {
			console.error();
		} else {
			console.error(chalk.gray(`  ${line}`));
		}
	}
}

async function main() {
	try {
		// Run tsc --listEmittedFiles to get only files that were emitted
		const { stdout, stderr } = await execAsync("tsc --listEmittedFiles", {
			cwd: projectRoot,
		});

		// Check for TypeScript errors in stderr
		if (stderr && stderr.trim()) {
			// Check if it contains error messages (TS#### format)
			if (stderr.includes("error TS")) {
				formatAndDisplayErrors(stderr);
				process.exit(1);
			}
		}

		// Parse output - each line is an emitted file path
		const lines = stdout
			.trim()
			.split("\n")
			.filter((line) => line.trim());

		// Convert emitted files to source files
		const sourceFiles = new Set();
		for (const emittedFile of lines) {
			const trimmed = emittedFile.trim();

			// Skip .map files and .tsbuildinfo
			if (trimmed.endsWith(".map") || trimmed.includes(".tsbuildinfo")) {
				continue;
			}

			// Convert to source file path
			const sourcePath = emittedToSourcePath(trimmed);
			if (
				sourcePath &&
				(sourcePath.endsWith(".ts") ||
					sourcePath.endsWith(".cts") ||
					sourcePath.endsWith(".mts"))
			) {
				sourceFiles.add(sourcePath);
			}
		}

		// Sort and display
		const sortedFiles = Array.from(sourceFiles).sort();

		if (sortedFiles.length === 0) {
			console.log(
				chalk.yellow("No files were compiled (incremental build - no changes).")
			);
			return;
		}

		console.log(
			chalk.blue.bold(`\nCompiled ${sortedFiles.length} source file(s):\n`)
		);

		for (const file of sortedFiles) {
			// Color code by extension
			let color = chalk.white;
			if (file.endsWith(".cts")) {
				color = chalk.cyan;
			} else if (file.endsWith(".mts")) {
				color = chalk.magenta;
			} else if (file.endsWith(".ts")) {
				color = chalk.green;
			}

			console.log(`  ${chalk.gray("•")} ${color(file)}`);
		}

		console.log(); // Blank line at end
	} catch (error) {
		// execAsync rejects when exit code is non-zero
		// The error object contains stdout and stderr
		const stderr = error.stderr || "";
		const stdout = error.stdout || "";

		// Combine stdout and stderr - TypeScript errors can be in either
		const allOutput = (stdout + "\n" + stderr).trim();

		// Check if it contains TypeScript errors
		if (allOutput.includes("error TS")) {
			formatAndDisplayErrors(allOutput);
			process.exit(1);
		}

		// If no recognizable errors, show the generic error message and all output
		console.error(chalk.red("Error running TypeScript:"), error.message);
		if (allOutput) {
			console.error(chalk.red("\nTypeScript output:"));
			console.error(allOutput);
		}
		process.exit(1);
	}
}

main().catch((error) => {
	console.error(chalk.red("Unexpected error:"), error);
	process.exit(1);
});
