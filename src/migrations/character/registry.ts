/**
 * Character Migration Registry
 *
 * Wrapper around the generic migration system for character-specific migrations.
 */

import type { SerializedCharacter } from "../../core/character.js";
import {
	registerMigration as registerGenericMigration,
	findMigrationPath as findGenericMigrationPath,
	getMigrationsFrom as getGenericMigrationsFrom,
	getAllMigrations as getAllGenericMigrations,
} from "../generic/registry.js";
import type { MigrationInfo } from "../generic/types.js";

/**
 * Register a character migration
 */
export function registerMigration(
	migration: MigrationInfo<SerializedCharacter & { version?: string }>
): void {
	registerGenericMigration("character", migration);
}

/**
 * Get all migrations that start from a given version
 */
export function getMigrationsFrom(
	version: string
): MigrationInfo<SerializedCharacter & { version?: string }>[] {
	return getGenericMigrationsFrom<SerializedCharacter & { version?: string }>(
		"character",
		version
	);
}

/**
 * Find the migration path from one version to another
 */
export function findMigrationPath(
	fromVersion: string,
	toVersion: string
): MigrationInfo<SerializedCharacter & { version?: string }>[] {
	return findGenericMigrationPath<SerializedCharacter & { version?: string }>(
		"character",
		fromVersion,
		toVersion
	);
}

/**
 * Get all registered migrations (for debugging/testing)
 */
export function getAllMigrations(): MigrationInfo<
	SerializedCharacter & { version?: string }
>[] {
	return getAllGenericMigrations<SerializedCharacter & { version?: string }>(
		"character"
	);
}
