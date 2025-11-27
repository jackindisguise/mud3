/**
 * Character Migration System Entry Point
 *
 * This file imports all character migrations to register them.
 * Add new migration files here to make them available.
 */

// Import migrations (they self-register via side effects)
//import "./v1.0.0-to-v1.0.1.js";

// Export public API
export { migrateCharacterData } from "./runner.js";
export { registerMigration, findMigrationPath } from "./registry.js";
