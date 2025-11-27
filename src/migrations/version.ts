/**
 * Version comparison utilities
 *
 * Uses semantic versioning (major.minor.patch) for comparison.
 */

/**
 * Compare two version strings.
 * Returns:
 * - Negative number if v1 < v2
 * - Zero if v1 === v2
 * - Positive number if v1 > v2
 */
export function compareVersions(v1: string, v2: string): number {
	const parts1 = v1.split(".").map(Number);
	const parts2 = v2.split(".").map(Number);

	// Ensure both have 3 parts (major.minor.patch)
	while (parts1.length < 3) parts1.push(0);
	while (parts2.length < 3) parts2.push(0);

	for (let i = 0; i < 3; i++) {
		if (parts1[i] < parts2[i]) return -1;
		if (parts1[i] > parts2[i]) return 1;
	}

	return 0;
}

/**
 * Get the current project version from package.json
 */
export async function getCurrentVersion(): Promise<string> {
	try {
		const { readFile } = await import("fs/promises");
		const { join } = await import("path");
		const { getSafeRootDirectory } = await import("../utils/path.js");
		const packageJsonPath = join(getSafeRootDirectory(), "package.json");
		const packageJsonContent = await readFile(packageJsonPath, "utf-8");
		const packageJson = JSON.parse(packageJsonContent);
		return packageJson.version || "1.0.0";
	} catch (error) {
		// Fallback version if we can't read package.json
		return "1.0.0";
	}
}
