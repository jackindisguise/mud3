/**
 * Mob Migration Registry
 *
 * Wrapper around the generic migration system for mob-specific migrations.
 */

import type { SerializedMob } from "../../core/dungeon.js";
import {
	registerMigration as registerGenericMigration,
	findMigrationPath as findGenericMigrationPath,
	getMigrationsFrom as getGenericMigrationsFrom,
	getAllMigrations as getAllGenericMigrations,
} from "../generic/registry.js";
import type { MigrationInfo } from "../generic/types.js";

/**
 * Register a mob migration
 */
export function registerMigration(
	migration: MigrationInfo<SerializedMob>
): void {
	registerGenericMigration("mob", migration);
}

/**
 * Get all migrations that start from a given version
 */
export function getMigrationsFrom(
	version: string
): MigrationInfo<SerializedMob>[] {
	return getGenericMigrationsFrom<SerializedMob>("mob", version);
}

/**
 * Find the migration path from one version to another
 */
export function findMigrationPath(
	fromVersion: string,
	toVersion: string
): MigrationInfo<SerializedMob>[] {
	return findGenericMigrationPath<SerializedMob>("mob", fromVersion, toVersion);
}

/**
 * Get all registered migrations (for debugging/testing)
 */
export function getAllMigrations(): MigrationInfo<SerializedMob>[] {
	return getAllGenericMigrations<SerializedMob>("mob");
}
