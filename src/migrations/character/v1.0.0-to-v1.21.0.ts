/**
 * Migration: v1.0.0 → v1.21.0
 *
 * Sets the version field for old character files that don't have a version.
 * This migration is a no-op since the version field is automatically added
 * by the migration runner, but it establishes the migration path from 1.0.0
 * (the default for files without a version) to the current version.
 */

import { registerMigration } from "./registry.js";
import type { SerializedCharacter } from "../../core/character.js";
import { COLOR, COLOR_NAMES } from "../../core/color.js";

registerMigration({
	from: "1.0.0",
	to: "1.21.0",
	description: "Added version field to root object",
	migrate: (
		data: SerializedCharacter & { version?: string }
	): SerializedCharacter & { version?: string } => {
		const oldColor =
			data.settings.defaultColor !== undefined
				? (data.settings.defaultColor as any as COLOR)
				: undefined;
		data.settings.defaultColor = oldColor ? COLOR_NAMES[oldColor] : undefined;
		return data;
	},
});
