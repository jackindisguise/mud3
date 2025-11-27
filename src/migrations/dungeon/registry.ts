/**
 * Dungeon Migration Registry
 *
 * Wrapper around the generic migration system for dungeon-specific migrations.
 * This maintains backward compatibility with the original API.
 */

import type { SerializedDungeonFormat } from "../../package/dungeon.js";
import {
	registerMigration as registerGenericMigration,
	findMigrationPath as findGenericMigrationPath,
	getMigrationsFrom as getGenericMigrationsFrom,
	getAllMigrations as getAllGenericMigrations,
} from "../generic/registry.js";
import type { MigrationInfo } from "../generic/types.js";

/**
 * Register a dungeon migration
 */
export function registerMigration(
	migration: MigrationInfo<SerializedDungeonFormat>
): void {
	registerGenericMigration("dungeon", migration);
}

/**
 * Get all migrations that start from a given version
 */
export function getMigrationsFrom(
	version: string
): MigrationInfo<SerializedDungeonFormat>[] {
	return getGenericMigrationsFrom<SerializedDungeonFormat>("dungeon", version);
}

/**
 * Find the migration path from one version to another
 */
export function findMigrationPath(
	fromVersion: string,
	toVersion: string
): MigrationInfo<SerializedDungeonFormat>[] {
	return findGenericMigrationPath<SerializedDungeonFormat>(
		"dungeon",
		fromVersion,
		toVersion
	);
}

/**
 * Get all registered migrations (for debugging/testing)
 */
export function getAllMigrations(): MigrationInfo<SerializedDungeonFormat>[] {
	return getAllGenericMigrations<SerializedDungeonFormat>("dungeon");
}
