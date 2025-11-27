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

async function main() {
	try {
		// Run tsc --listEmittedFiles to get only files that were emitted
		const { stdout, stderr } = await execAsync("tsc --listEmittedFiles", {
			cwd: projectRoot,
		});

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
			if (stderr) {
				console.error(chalk.yellow("\nTypeScript warnings:"));
				console.error(stderr);
			}
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

		// Show errors if any
		if (stderr && !stderr.includes("TS")) {
			console.error(chalk.yellow("\nTypeScript warnings:"));
			console.error(stderr);
		}
	} catch (error) {
		console.error(chalk.red("Error running TypeScript:"), error.message);
		if (error.stderr) {
			console.error(chalk.red("\nTypeScript errors:"));
			console.error(error.stderr);
		}
		process.exit(1);
	}
}

main().catch((error) => {
	console.error(chalk.red("Unexpected error:"), error);
	process.exit(1);
});
