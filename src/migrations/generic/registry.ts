/**
 * Generic Migration Registry
 *
 * Automatically discovers and registers all migrations for any data type.
 * Migrations are executed in sequence to transform data from old versions to current.
 */

import type { MigrationInfo } from "./types.js";
import { compareVersions } from "../version.js";

/**
 * Registry of all migrations, keyed by data type and "from" version
 */
const migrations = new Map<string, Map<string, MigrationInfo<any>[]>>();

/**
 * Register a migration for a specific data type
 */
export function registerMigration<T>(
	dataType: string,
	migration: MigrationInfo<T>
): void {
	let typeMigrations = migrations.get(dataType);
	if (!typeMigrations) {
		typeMigrations = new Map();
		migrations.set(dataType, typeMigrations);
	}

	const existing = typeMigrations.get(migration.from) || [];
	existing.push(migration);
	// Sort by "to" version to ensure correct order
	existing.sort((a, b) => compareVersions(a.to, b.to));
	typeMigrations.set(migration.from, existing);
}

/**
 * Get all migrations that start from a given version for a data type
 */
export function getMigrationsFrom<T>(
	dataType: string,
	version: string
): MigrationInfo<T>[] {
	const typeMigrations = migrations.get(dataType);
	if (!typeMigrations) {
		return [];
	}
	return typeMigrations.get(version) || [];
}

/**
 * Find the migration path from one version to another for a data type.
 * Returns an array of migrations to execute in order.
 *
 * Uses a simple BFS to find the shortest path.
 */
export function findMigrationPath<T>(
	dataType: string,
	fromVersion: string,
	toVersion: string
): MigrationInfo<T>[] {
	if (fromVersion === toVersion) {
		return [];
	}

	// BFS to find shortest path
	const queue: Array<{ version: string; path: MigrationInfo<T>[] }> = [
		{ version: fromVersion, path: [] },
	];
	const visited = new Set<string>([fromVersion]);

	while (queue.length > 0) {
		const { version, path } = queue.shift()!;

		// Get all migrations from this version
		const availableMigrations = getMigrationsFrom<T>(dataType, version);

		for (const migration of availableMigrations) {
			// Check if this migration gets us to the target
			if (migration.to === toVersion) {
				return [...path, migration];
			}

			// If we haven't visited this version yet, add it to the queue
			if (!visited.has(migration.to)) {
				visited.add(migration.to);
				queue.push({
					version: migration.to,
					path: [...path, migration],
				});
			}
		}
	}

	// No path found - this means there's a gap in migrations
	throw new Error(
		`No migration path found for ${dataType} from version ${fromVersion} to ${toVersion}`
	);
}

/**
 * Get all registered migrations for a data type (for debugging/testing)
 */
export function getAllMigrations<T>(dataType: string): MigrationInfo<T>[] {
	const typeMigrations = migrations.get(dataType);
	if (!typeMigrations) {
		return [];
	}
	const all: MigrationInfo<T>[] = [];
	for (const migrationsList of typeMigrations.values()) {
		all.push(...migrationsList);
	}
	return all;
}
