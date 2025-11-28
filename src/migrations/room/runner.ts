/**
 * Room Migration Runner
 *
 * Wrapper around the generic migration runner for room-specific migrations.
 */

import type { SerializedRoom } from "../../core/dungeon.js";
import { migrateData } from "../generic/runner.js";
// Import migrations to register them
import "./index.js";

/**
 * Migrate room data from its current version to the latest version.
 * If the data is already at the current version, returns it unchanged.
 *
 * @param data The room data to migrate
 * @param roomId Optional room identifier for logging
 * @returns Migrated data at the current version
 */
export async function migrateRoomData(
	data: SerializedRoom & { version?: string },
	roomId?: string
): Promise<SerializedRoom & { version?: string }> {
	return migrateData<SerializedRoom & { version?: string }>(
		"room",
		data,
		roomId
	);
}
