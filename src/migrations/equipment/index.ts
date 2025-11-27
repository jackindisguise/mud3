/**
 * Equipment Migration System Entry Point
 *
 * This file imports all equipment migrations to register them.
 * Add new migration files here to make them available.
 */

// Import migrations (they self-register via side effects)
import "./v1.0.0-to-v1.21.0.js";

// Export public API
export { migrateEquipmentData } from "./runner.js";
export { registerMigration, findMigrationPath } from "./registry.js";
export type { Migration, MigrationInfo } from "./types.js";

