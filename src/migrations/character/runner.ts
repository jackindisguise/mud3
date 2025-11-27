/**
 * Character Migration Runner
 *
 * Wrapper around the generic migration runner for character-specific migrations.
 */

import type { SerializedCharacter } from "../../core/character.js";
import { migrateData } from "../generic/runner.js";
// Import migrations to register them
import "./index.js";

/**
 * Migrate character data from its current version to the latest version.
 * If the data is already at the current version, returns it unchanged.
 *
 * @param data The character data to migrate
 * @param username Optional username for logging
 * @returns Migrated data at the current version
 */
export async function migrateCharacterData(
	data: SerializedCharacter & { version?: string },
	username?: string
): Promise<SerializedCharacter & { version?: string }> {
	return migrateData<SerializedCharacter & { version?: string }>(
		"character",
		data,
		username
	);
}
