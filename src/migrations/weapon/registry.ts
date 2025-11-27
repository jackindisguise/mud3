/**
 * Weapon Migration Registry
 *
 * Wrapper around the generic migration system for weapon-specific migrations.
 */

import type { SerializedWeapon } from "../../core/dungeon.js";
import {
	registerMigration as registerGenericMigration,
	findMigrationPath as findGenericMigrationPath,
	getMigrationsFrom as getGenericMigrationsFrom,
	getAllMigrations as getAllGenericMigrations,
} from "../generic/registry.js";
import type { MigrationInfo } from "../generic/types.js";

/**
 * Register a weapon migration
 */
export function registerMigration(
	migration: MigrationInfo<SerializedWeapon>
): void {
	registerGenericMigration("weapon", migration);
}

/**
 * Get all migrations that start from a given version
 */
export function getMigrationsFrom(
	version: string
): MigrationInfo<SerializedWeapon>[] {
	return getGenericMigrationsFrom<SerializedWeapon>("weapon", version);
}

/**
 * Find the migration path from one version to another
 */
export function findMigrationPath(
	fromVersion: string,
	toVersion: string
): MigrationInfo<SerializedWeapon>[] {
	return findGenericMigrationPath<SerializedWeapon>(
		"weapon",
		fromVersion,
		toVersion
	);
}

/**
 * Get all registered migrations (for debugging/testing)
 */
export function getAllMigrations(): MigrationInfo<SerializedWeapon>[] {
	return getAllGenericMigrations<SerializedWeapon>("weapon");
}

