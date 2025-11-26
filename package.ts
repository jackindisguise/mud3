/**
 * Package loader that automatically discovers and loads all packages
 * from src/package/ directory in the correct dependency order.
 *
 * This module:
 * 1. Discovers all package files in src/package/ (dist/src/package/ at runtime)
 * 2. Builds a dependency graph from package dependencies
 * 3. Loads packages in topological order (dependencies first)
 */

import { fileURLToPath } from "url";
import { dirname, join, resolve } from "path";
import { readdir, stat } from "fs/promises";
import { existsSync } from "fs";
import { loadPackage, type Package } from "package-loader";
import logger from "./src/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname);

/**
 * Check if a file is a package file (not a test file)
 */
function isPackageFile(filename: string): boolean {
	return (
		(filename.endsWith(".ts") || filename.endsWith(".js")) &&
		!filename.endsWith(".d.ts") &&
		!filename.endsWith(".spec.ts") &&
		!filename.endsWith(".spec.js") &&
		!filename.endsWith(".test.ts") &&
		!filename.endsWith(".test.js")
	);
}

/**
 * Recursively find all package files in a directory
 */
async function findPackageFiles(dir: string): Promise<string[]> {
	const files: string[] = [];
	try {
		const entries = await readdir(dir, { withFileTypes: true });
		for (const entry of entries) {
			if (entry.isFile() && isPackageFile(entry.name)) {
				files.push(join(dir, entry.name));
			}
		}
	} catch (error) {
		// Ignore errors (e.g., permission denied)
	}
	return files;
}

/**
 * Load a package module and extract its Package definition
 */
async function loadPackageModule(
	filePath: string,
	isRuntime: boolean
): Promise<{ name: string; package: Package; filePath: string }> {
	// Normalize path separators to forward slashes for consistent handling
	const normalizedPath = filePath.replace(/\\/g, "/");
	const normalizedRoot = projectRoot.replace(/\\/g, "/");

	// Convert file path to import path (relative to project root)
	const relativePath = normalizedPath.replace(normalizedRoot + "/", "");

	let importPath: string;
	if (isRuntime) {
		// At runtime, we're in dist/, files are in dist/src/package/foo.js
		// Import as ./src/package/foo.js
		importPath = relativePath.replace(/^dist\//, "./").replace(/\.ts$/, ".js");
	} else {
		// In development, files are in src/package/foo.ts
		// Import as ./src/package/foo.ts
		importPath = relativePath.replace(/^src\//, "./src/");
	}

	// Ensure import path starts with ./ or ../
	if (!importPath.startsWith("./") && !importPath.startsWith("../")) {
		importPath = "./" + importPath;
	}

	try {
		const module = await import(importPath);
		const pkg = module.default as Package;

		if (!pkg || !pkg.name) {
			throw new Error(
				`Package file ${filePath} does not export a default Package object with a name`
			);
		}

		return {
			name: pkg.name,
			package: pkg,
			filePath: relativePath,
		};
	} catch (error) {
		throw new Error(`Failed to load package from ${filePath}: ${error}`);
	}
}

/**
 * Build a dependency graph from packages
 */
function buildDependencyGraph(
	packages: Array<{ name: string; package: Package; filePath: string }>
): Map<string, Set<string>> {
	const graph = new Map<string, Set<string>>();
	const packageMap = new Map<
		string,
		{ name: string; package: Package; filePath: string }
	>();

	// Create map of package names to package objects
	for (const pkg of packages) {
		packageMap.set(pkg.name, pkg);
		graph.set(pkg.name, new Set());
	}

	// Build dependency edges
	for (const pkg of packages) {
		if (pkg.package.dependencies) {
			for (const dep of pkg.package.dependencies) {
				const depName = typeof dep === "string" ? dep : dep.name;
				if (!packageMap.has(depName)) {
					logger.warn(
						`Package "${pkg.name}" depends on "${depName}" which was not found in package directory`
					);
					continue;
				}
				graph.get(pkg.name)!.add(depName);
			}
		}
	}

	return graph;
}

/**
 * Topological sort of packages based on dependencies
 * Returns packages in order: dependencies first, dependents last
 */
function topologicalSort(
	packages: Array<{ name: string; package: Package; filePath: string }>,
	graph: Map<string, Set<string>>
): Array<{ name: string; package: Package; filePath: string }> {
	const sorted: Array<{ name: string; package: Package; filePath: string }> =
		[];
	const visited = new Set<string>();
	const visiting = new Set<string>();
	const packageMap = new Map<
		string,
		{ name: string; package: Package; filePath: string }
	>();

	// Create map for quick lookup
	for (const pkg of packages) {
		packageMap.set(pkg.name, pkg);
	}

	/**
	 * Visit a package and its dependencies
	 */
	function visit(name: string): void {
		if (visiting.has(name)) {
			const cycle = Array.from(visiting).concat([name]);
			throw new Error(`Circular dependency detected: ${cycle.join(" -> ")}`);
		}

		if (visited.has(name)) {
			return;
		}

		visiting.add(name);

		// Visit all dependencies first
		const deps = graph.get(name);
		if (deps) {
			for (const dep of deps) {
				visit(dep);
			}
		}

		visiting.delete(name);
		visited.add(name);

		// Add to sorted list
		const pkg = packageMap.get(name);
		if (pkg) {
			sorted.push(pkg);
		}
	}

	// Visit all packages
	for (const pkg of packages) {
		if (!visited.has(pkg.name)) {
			visit(pkg.name);
		}
	}

	return sorted;
}

/**
 * Load all packages from src/package/ directory in dependency order
 */
export async function loadAllPackages(): Promise<void> {
	// Determine the package directory (dist/src/package at runtime, src/package for development)
	const distPackageDir = join(projectRoot, "dist", "src", "package");
	const srcPackageDir = join(projectRoot, "src", "package");

	const isRuntime = existsSync(distPackageDir);
	const packageDir = isRuntime ? distPackageDir : srcPackageDir;

	if (!existsSync(packageDir)) {
		throw new Error(`Package directory not found: ${packageDir}`);
	}

	logger.info(`Discovering packages in ${packageDir}...`);

	// Find all package files
	const packageFiles = await findPackageFiles(packageDir);

	if (packageFiles.length === 0) {
		logger.warn(`No package files found in ${packageDir}`);
		return;
	}

	logger.info(`Found ${packageFiles.length} package file(s)`);

	// Load all package modules
	const packages: Array<{ name: string; package: Package; filePath: string }> =
		[];
	for (const file of packageFiles) {
		try {
			const pkg = await loadPackageModule(file, isRuntime);
			packages.push(pkg);
			logger.debug(
				`Loaded package definition: ${pkg.name} from ${pkg.filePath}`
			);
		} catch (error) {
			logger.error(`Failed to load package from ${file}: ${error}`);
			throw error;
		}
	}

	// Build dependency graph
	const graph = buildDependencyGraph(packages);

	// Sort packages by dependency order
	let sortedPackages = topologicalSort(packages, graph);

	// Ensure lockfile is always first (if it exists)
	const lockfileIndex = sortedPackages.findIndex((p) => p.name === "lockfile");
	if (lockfileIndex > 0) {
		const lockfile = sortedPackages[lockfileIndex];
		sortedPackages = [
			lockfile,
			...sortedPackages.slice(0, lockfileIndex),
			...sortedPackages.slice(lockfileIndex + 1),
		];
	}

	logger.info(
		`Loading ${sortedPackages.length} package(s) in dependency order...`
	);

	// Load packages in order
	for (const pkg of sortedPackages) {
		await logger.block(pkg.name, async () => {
			logger.debug(`Loading package: ${pkg.name}`);
			await loadPackage(pkg.package);
		});
	}

	logger.info(`Successfully loaded ${sortedPackages.length} package(s)`);
}
