/**
 * Version comparison utilities
 *
 * Uses semantic versioning (major.minor.patch) for comparison.
 */
import { readFile } from "fs/promises";
import { join } from "path";
import semver from "semver";
import { getSafeRootDirectory } from "../utils/path.js";

/**
 * Compare two version strings using semver.
 * Returns:
 * - Negative number if v1 < v2
 * - Zero if v1 === v2
 * - Positive number if v1 > v2
 */
export function compareVersions(v1: string, v2: string): number {
	return semver.compare(v1, v2);
}

/**
 * Get the current dungeon version from package.json
 * This version only increments when dungeon migrations are needed.
 */
export async function getCurrentDungeonVersion(): Promise<string> {
	try {
		const packageJsonPath = join(getSafeRootDirectory(), "package.json");
		const packageJsonContent = await readFile(packageJsonPath, "utf-8");
		const packageJson = JSON.parse(packageJsonContent);
		return packageJson.dungeonVersion || "1.0.0";
	} catch (error) {
		// Fallback version if we can't read package.json
		return "1.0.0";
	}
}
