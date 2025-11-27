/**
 * Example Migration: v1.20.0 → v1.21.0
 *
 * This is an example migration file showing how to create migrations.
 * In a real scenario, this would transform data from the old format to the new format.
 *
 * To use this migration:
 * 1. Import it in migrations/dungeon/index.ts
 * 2. The migration will automatically register itself
 * 3. It will be executed when loading dungeons from v1.20.0
 */

import { registerMigration } from "./registry.js";
import type { SerializedDungeonFormat } from "../../package/dungeon.js";

registerMigration({
	from: "1.20.0",
	to: "1.21.0",
	description: "Added version field to root object",
	migrate: (data: SerializedDungeonFormat): SerializedDungeonFormat => {
		// This migration is a no-op since we're just adding the version field,
		// which is handled automatically by the migration runner.
		// In a real migration, you might:
		// - Rename fields: data.dungeon.newField = data.dungeon.oldField; delete data.dungeon.oldField;
		// - Transform structures: data.dungeon.someArray = transformArray(data.dungeon.oldArray);
		// - Remove deprecated fields: delete data.dungeon.deprecatedField;
		// - Add default values: data.dungeon.newField = data.dungeon.newField || defaultValue;

		return data;
	},
});
