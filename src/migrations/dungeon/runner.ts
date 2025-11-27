/**
 * Dungeon Migration Runner
 *
 * Wrapper around the generic migration runner for dungeon-specific migrations.
 */

import type { SerializedDungeonFormat } from "../../package/dungeon.js";
import { migrateData } from "../generic/runner.js";
// Import migrations to register them
import "./index.js";

/**
 * Migrate dungeon data from its current version to the latest version.
 * If the data is already at the current version, returns it unchanged.
 *
 * @param data The dungeon data to migrate
 * @param dungeonId Optional dungeon ID for logging
 * @returns Migrated data at the current version
 */
export async function migrateDungeonData(
	data: SerializedDungeonFormat,
	dungeonId?: string
): Promise<SerializedDungeonFormat> {
	return migrateData<SerializedDungeonFormat>("dungeon", data, dungeonId);
}
