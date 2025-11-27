#!/usr/bin/env node
/**
 * Script to increment dungeonVersion in package.json using semver
 *
 * Usage:
 *   node scripts/increment-dungeon-version.js [major|minor|patch]
 *
 * Defaults to patch if no argument provided.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import semver from "semver";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const packageJsonPath = path.join(rootDir, "package.json");

/**
 * Read and parse package.json
 */
function readPackageJson() {
	if (!fs.existsSync(packageJsonPath)) {
		throw new Error(`package.json not found at ${packageJsonPath}`);
	}

	const content = fs.readFileSync(packageJsonPath, "utf8");
	return JSON.parse(content);
}

/**
 * Write package.json with proper formatting
 */
function writePackageJson(packageJson) {
	const content = JSON.stringify(packageJson, null, "\t") + "\n";
	fs.writeFileSync(packageJsonPath, content, "utf8");
}

// Main execution
try {
	const incrementType = process.argv[2] || "patch";

	if (!["major", "minor", "patch"].includes(incrementType)) {
		console.error(`Error: Invalid increment type "${incrementType}"`);
		console.error(
			"Usage: node scripts/increment-dungeon-version.js [major|minor|patch]"
		);
		process.exit(1);
	}

	const packageJson = readPackageJson();

	if (!packageJson.dungeonVersion) {
		throw new Error("dungeonVersion field not found in package.json");
	}

	const currentVersion = packageJson.dungeonVersion;

	// Validate current version
	if (!semver.valid(currentVersion)) {
		throw new Error(
			`Invalid dungeonVersion format: ${currentVersion}. Expected semantic version (e.g., 1.0.0)`
		);
	}

	// Increment using semver
	const newVersion = semver.inc(currentVersion, incrementType);

	if (!newVersion) {
		throw new Error(
			`Failed to increment version ${currentVersion} as ${incrementType}`
		);
	}

	packageJson.dungeonVersion = newVersion;
	writePackageJson(packageJson);

	console.log(
		`dungeonVersion incremented: ${currentVersion} → ${newVersion} (${incrementType})`
	);
} catch (error) {
	console.error(`Error: ${error.message}`);
	process.exit(1);
}
