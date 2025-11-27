/**
 * Equipment Migration Runner
 *
 * Wrapper around the generic migration runner for equipment-specific migrations.
 */

import type { SerializedEquipment } from "../../core/dungeon.js";
import { migrateData } from "../generic/runner.js";
// Import migrations to register them
import "./index.js";

/**
 * Migrate equipment data from its current version to the latest version.
 * If the data is already at the current version, returns it unchanged.
 *
 * @param data The equipment data to migrate
 * @param equipmentId Optional equipment identifier for logging
 * @returns Migrated data at the current version
 */
export async function migrateEquipmentData(
	data: SerializedEquipment & { version?: string },
	equipmentId?: string
): Promise<SerializedEquipment & { version?: string }> {
	return migrateData<SerializedEquipment & { version?: string }>(
		"equipment",
		data,
		equipmentId
	);
}


