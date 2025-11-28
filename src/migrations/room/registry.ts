/**
 * Room Migration Registry
 *
 * Wrapper around the generic migration system for room-specific migrations.
 */

import type { SerializedRoom } from "../../core/dungeon.js";
import {
	registerMigration as registerGenericMigration,
	findMigrationPath as findGenericMigrationPath,
	getMigrationsFrom as getGenericMigrationsFrom,
	getAllMigrations as getAllGenericMigrations,
} from "../generic/registry.js";
import type { MigrationInfo } from "../generic/types.js";

/**
 * Register a room migration
 */
export function registerMigration(
	migration: MigrationInfo<SerializedRoom>
): void {
	registerGenericMigration("room", migration);
}

/**
 * Get all migrations that start from a given version
 */
export function getMigrationsFrom(
	version: string
): MigrationInfo<SerializedRoom>[] {
	return getGenericMigrationsFrom<SerializedRoom>("room", version);
}

/**
 * Find the migration path from one version to another
 */
export function findMigrationPath(
	fromVersion: string,
	toVersion: string
): MigrationInfo<SerializedRoom>[] {
	return findGenericMigrationPath<SerializedRoom>(
		"room",
		fromVersion,
		toVersion
	);
}

/**
 * Get all registered migrations (for debugging/testing)
 */
export function getAllMigrations(): MigrationInfo<SerializedRoom>[] {
	return getAllGenericMigrations<SerializedRoom>("room");
}
