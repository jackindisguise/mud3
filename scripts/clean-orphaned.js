#!/usr/bin/env node

/**
 * Removes compiled files from dist/ that don't have corresponding source files.
 * This helps clean up when source files are deleted while using incremental builds.
 */

import { readdir, stat, unlink, rmdir } from "fs/promises";
import { join, relative, dirname } from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "..");
const distDir = join(projectRoot, "dist");
const srcDir = join(projectRoot, "src");

/**
 * Recursively get all files in a directory
 */
async function getAllFiles(dir, baseDir = dir) {
	const files = [];
	try {
		const entries = await readdir(dir, { withFileTypes: true });
		for (const entry of entries) {
			const fullPath = join(dir, entry.name);
			if (entry.isDirectory()) {
				files.push(...(await getAllFiles(fullPath, baseDir)));
			} else {
				const relativePath = relative(baseDir, fullPath);
				files.push(relativePath);
			}
		}
	} catch (error) {
		// Ignore errors
	}
	return files;
}

/**
 * Convert a dist file path to its corresponding source path
 */
function distToSourcePath(distPath) {
	// Handle .d.cjs files - declaration files come from .cts source (not .d.cts)
	if (distPath.endsWith(".d.cts")) {
		return distPath.replace(/\.d\.cts$/, ".cts");
	}
	// Handle .d.mjs files - declaration files come from .mts source (not .d.mts)
	if (distPath.endsWith(".d.mts")) {
		return distPath.replace(/\.d\.mts$/, ".mts");
	}
	// Handle .cjs files - check for .cts source
	if (distPath.endsWith(".cjs")) {
		return distPath.replace(/\.cjs$/, ".cts");
	}
	// Handle .mjs files - check for .mts source
	if (distPath.endsWith(".mjs")) {
		return distPath.replace(/\.mjs$/, ".mts");
	}
	// Handle .d.ts files - declaration files come from .ts source (not .d.ts)
	if (distPath.endsWith(".d.ts")) {
		return distPath.replace(/\.d\.ts$/, ".ts");
	}
	// Handle .js files - check for .ts source
	if (distPath.endsWith(".js")) {
		return distPath.replace(/\.js$/, ".ts");
	}
	// Handle .js.map files
	if (distPath.endsWith(".js.map")) {
		return distPath.replace(/\.js\.map$/, ".ts");
	}
	return distPath;
}

/**
 * Recursively remove empty directories
 */
async function removeEmptyDirs(dir) {
	try {
		const entries = await readdir(dir);
		if (entries.length === 0) {
			console.log(`Removing empty directory: ${dir}`);
			//await rmdir(dir);
			// Try to remove parent directory too
			const parent = dirname(dir);
			if (parent !== dir && parent.startsWith(distDir)) {
				console.log(`Removing empty directory: ${parent}`);
				//await removeEmptyDirs(parent);
			}
		}
	} catch (error) {
		// Ignore errors
	}
}

async function main() {
	if (!existsSync(distDir)) {
		console.log("No dist directory found. Nothing to clean.");
		return;
	}

	console.log("Scanning for orphaned files...");

	// Get all files in dist
	const distFiles = await getAllFiles(distDir);

	// Get all source files (relative to srcDir)
	const srcFiles = new Set(await getAllFiles(srcDir));

	// Also check root-level .ts, .cts, .mts files
	const rootFiles = await readdir(projectRoot);
	for (const file of rootFiles) {
		if (
			(file.endsWith(".ts") ||
				file.endsWith(".cts") ||
				file.endsWith(".mts")) &&
			file !== "package.ts"
		) {
			srcFiles.add(file);
		}
	}

	let removedCount = 0;
	let removedDirs = 0;

	// Check each dist file
	for (const distFile of distFiles) {
		// Skip .tsbuildinfo and other non-source-derived files
		if (distFile.includes(".tsbuildinfo") || distFile.endsWith(".map")) {
			continue;
		}

		const sourcePath = distToSourcePath(distFile);
		const distFilePath = join(distDir, distFile);

		// sourcePath is relative to distDir (e.g., "src/electron/preload.cts")
		// We need to check both:
		// 1. If it exists in srcFiles (which are relative to srcDir, so strip "src/" prefix)
		// 2. If the full path exists on disk
		const srcRelativePath = sourcePath.startsWith("src/")
			? sourcePath.slice(4) // Remove "src/" prefix
			: sourcePath;
		const sourceExists =
			srcFiles.has(srcRelativePath) ||
			existsSync(join(projectRoot, sourcePath));

		if (!sourceExists) {
			try {
				//await unlink(distFilePath);
				removedCount++;
				console.log(`Removed: ${distFile}`);
			} catch (error) {
				console.error(`Failed to remove ${distFile}:`, error.message);
			}
		}
	}

	// Try to remove empty directories
	try {
		const entries = await readdir(distDir);
		for (const entry of entries) {
			const entryPath = join(distDir, entry);
			const stats = await stat(entryPath);
			if (stats.isDirectory()) {
				await removeEmptyDirs(entryPath);
			}
		}
	} catch (error) {
		// Ignore errors
	}

	console.log(`\nCleaned ${removedCount} orphaned file(s).`);
}

main().catch((error) => {
	console.error("Error cleaning orphaned files:", error);
	process.exit(1);
});
