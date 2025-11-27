/**
 * Equipment Migration Registry
 *
 * Wrapper around the generic migration system for equipment-specific migrations.
 */

import type { SerializedEquipment } from "../../core/dungeon.js";
import {
	registerMigration as registerGenericMigration,
	findMigrationPath as findGenericMigrationPath,
	getMigrationsFrom as getGenericMigrationsFrom,
	getAllMigrations as getAllGenericMigrations,
} from "../generic/registry.js";
import type { MigrationInfo } from "../generic/types.js";

/**
 * Register an equipment migration
 */
export function registerMigration(
	migration: MigrationInfo<SerializedEquipment>
): void {
	registerGenericMigration("equipment", migration);
}

/**
 * Get all migrations that start from a given version
 */
export function getMigrationsFrom(
	version: string
): MigrationInfo<SerializedEquipment>[] {
	return getGenericMigrationsFrom<SerializedEquipment>("equipment", version);
}

/**
 * Find the migration path from one version to another
 */
export function findMigrationPath(
	fromVersion: string,
	toVersion: string
): MigrationInfo<SerializedEquipment>[] {
	return findGenericMigrationPath<SerializedEquipment>(
		"equipment",
		fromVersion,
		toVersion
	);
}

/**
 * Get all registered migrations (for debugging/testing)
 */
export function getAllMigrations(): MigrationInfo<SerializedEquipment>[] {
	return getAllGenericMigrations<SerializedEquipment>("equipment");
}

