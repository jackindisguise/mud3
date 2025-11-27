/**
 * Mob Migration Runner
 *
 * Wrapper around the generic migration runner for mob-specific migrations.
 */

import type { SerializedMob } from "../../core/dungeon.js";
import { migrateData } from "../generic/runner.js";
// Import migrations to register them
import "./index.js";

/**
 * Migrate mob data from its current version to the latest version.
 * If the data is already at the current version, returns it unchanged.
 *
 * @param data The mob data to migrate
 * @param mobId Optional mob identifier for logging
 * @returns Migrated data at the current version
 */
export async function migrateMobData(
	data: SerializedMob & { version?: string },
	mobId?: string
): Promise<SerializedMob & { version?: string }> {
	return migrateData<SerializedMob & { version?: string }>(
		"mob",
		data,
		mobId
	);
}

