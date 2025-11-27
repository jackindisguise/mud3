/**
 * Item Migration Registry
 *
 * Wrapper around the generic migration system for item-specific migrations.
 */

import type { SerializedItem } from "../../core/dungeon.js";
import {
	registerMigration as registerGenericMigration,
	findMigrationPath as findGenericMigrationPath,
	getMigrationsFrom as getGenericMigrationsFrom,
	getAllMigrations as getAllGenericMigrations,
} from "../generic/registry.js";
import type { MigrationInfo } from "../generic/types.js";

/**
 * Register an item migration
 */
export function registerMigration(
	migration: MigrationInfo<SerializedItem>
): void {
	registerGenericMigration("item", migration);
}

/**
 * Get all migrations that start from a given version
 */
export function getMigrationsFrom(
	version: string
): MigrationInfo<SerializedItem>[] {
	return getGenericMigrationsFrom<SerializedItem>("item", version);
}

/**
 * Find the migration path from one version to another
 */
export function findMigrationPath(
	fromVersion: string,
	toVersion: string
): MigrationInfo<SerializedItem>[] {
	return findGenericMigrationPath<SerializedItem>(
		"item",
		fromVersion,
		toVersion
	);
}

/**
 * Get all registered migrations (for debugging/testing)
 */
export function getAllMigrations(): MigrationInfo<SerializedItem>[] {
	return getAllGenericMigrations<SerializedItem>("item");
}
