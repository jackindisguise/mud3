/**
 * Migration: v1.0.0 → v1.21.0
 *
 * Sets the version field for old dungeon files that don't have a version.
 * This migration is a no-op since the version field is automatically added
 * by the migration runner, but it establishes the migration path from 1.0.0
 * (the default for files without a version) to the current version.
 */

import { registerMigration } from "./registry.js";
import type { SerializedDungeonFormat } from "../../package/dungeon.js";

registerMigration({
	from: "1.0.0",
	to: "1.0.1",
	description: "Added version field to root object",
	migrate: (data: SerializedDungeonFormat): SerializedDungeonFormat => {
		// No-op migration - the version field is automatically set by the migration runner
		// This migration exists to establish the path from old files (default 1.0.0) to current version
		return data;
	},
});
