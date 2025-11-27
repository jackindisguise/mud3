/**
 * Migration System Entry Point
 *
 * This file re-exports migration APIs for convenience.
 * Specific migration systems are in their respective directories:
 * - Dungeon migrations: ./dungeon/
 * - Character migrations: ./character/
 */

// Export dungeon migration API
export { migrateDungeonData } from "./dungeon/runner.js";
export { registerMigration, findMigrationPath } from "./dungeon/registry.js";
export type { Migration, MigrationInfo } from "./dungeon/types.js";

// Export version utilities
export { compareVersions, getCurrentVersion } from "./version.js";

// Export generic migration system for other data types
export { migrateData } from "./generic/runner.js";
export {
	registerMigration as registerGenericMigration,
	findMigrationPath as findGenericMigrationPath,
} from "./generic/registry.js";
export type {
	Migration as GenericMigration,
	MigrationInfo as GenericMigrationInfo,
} from "./generic/types.js";
