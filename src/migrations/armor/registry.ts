/**
 * Armor Migration Registry
 *
 * Wrapper around the generic migration system for armor-specific migrations.
 */

import type { SerializedArmor } from "../../core/dungeon.js";
import {
	registerMigration as registerGenericMigration,
	findMigrationPath as findGenericMigrationPath,
	getMigrationsFrom as getGenericMigrationsFrom,
	getAllMigrations as getAllGenericMigrations,
} from "../generic/registry.js";
import type { MigrationInfo } from "../generic/types.js";

/**
 * Register an armor migration
 */
export function registerMigration(
	migration: MigrationInfo<SerializedArmor>
): void {
	registerGenericMigration("armor", migration);
}

/**
 * Get all migrations that start from a given version
 */
export function getMigrationsFrom(
	version: string
): MigrationInfo<SerializedArmor>[] {
	return getGenericMigrationsFrom<SerializedArmor>("armor", version);
}

/**
 * Find the migration path from one version to another
 */
export function findMigrationPath(
	fromVersion: string,
	toVersion: string
): MigrationInfo<SerializedArmor>[] {
	return findGenericMigrationPath<SerializedArmor>(
		"armor",
		fromVersion,
		toVersion
	);
}

/**
 * Get all registered migrations (for debugging/testing)
 */
export function getAllMigrations(): MigrationInfo<SerializedArmor>[] {
	return getAllGenericMigrations<SerializedArmor>("armor");
}

