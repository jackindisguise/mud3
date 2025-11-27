/**
 * Generic Migration Runner
 *
 * Executes migrations to transform data from an old version to the current version.
 */

import { findMigrationPath } from "./registry.js";
import { getCurrentDungeonVersion, compareVersions } from "../version.js";
import logger from "../../logger.js";

/**
 * Migrate data from its current version to the latest version.
 * If the data is already at the current version, returns it unchanged.
 *
 * @param dataType The type of data being migrated (e.g., "dungeon", "character")
 * @param data The data to migrate (must have optional version field)
 * @param identifier Optional identifier for logging (e.g., dungeon ID, character username)
 * @returns Migrated data at the current version
 */
export async function migrateData<T extends { version?: string }>(
	dataType: string,
	data: T,
	identifier?: string
): Promise<T> {
	const fileVersion = data.version || "1.0.0"; // Default for old files without version
	const currentVersion = await getCurrentDungeonVersion();

	// If already at current version, no migration needed
	if (fileVersion === currentVersion) {
		return data;
	}

	// Check if file version is newer than current (shouldn't happen, but handle gracefully)
	if (compareVersions(fileVersion, currentVersion) > 0) {
		logger.warn(
			`${dataType} ${
				identifier || "unknown"
			} is at version ${fileVersion}, which is newer than current ${currentVersion}. Skipping migration.`
		);
		return data;
	}

	// Find migration path
	let migrationPath;
	try {
		migrationPath = findMigrationPath<T>(dataType, fileVersion, currentVersion);
	} catch (error) {
		logger.error(
			`Failed to find migration path for ${dataType} ${
				identifier || "unknown"
			}: ${error}`
		);
		throw error;
	}

	// If no migrations needed (shouldn't happen given the check above, but be safe)
	if (migrationPath.length === 0) {
		return data;
	}

	logger.info(
		`Migrating ${dataType} ${
			identifier || "unknown"
		} from ${fileVersion} to ${currentVersion} (${
			migrationPath.length
		} step(s))`
	);

	// Execute migrations in sequence
	let migratedData = data;
	for (const migration of migrationPath) {
		logger.debug(
			`Applying ${dataType} migration: ${migration.from} → ${migration.to}${
				migration.description ? ` (${migration.description})` : ""
			}`
		);
		migratedData = migration.migrate(migratedData);
		// Update version after each migration
		migratedData.version = migration.to;
	}

	// Ensure final version matches current
	migratedData.version = currentVersion;

	logger.debug(
		`Migration complete for ${dataType} ${
			identifier || "unknown"
		}: ${fileVersion} → ${currentVersion}`
	);

	return migratedData;
}
