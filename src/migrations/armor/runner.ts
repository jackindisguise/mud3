/**
 * Armor Migration Runner
 *
 * Wrapper around the generic migration runner for armor-specific migrations.
 */

import type { SerializedArmor } from "../../core/dungeon.js";
import { migrateData } from "../generic/runner.js";
// Import migrations to register them
import "./index.js";

/**
 * Migrate armor data from its current version to the latest version.
 * If the data is already at the current version, returns it unchanged.
 *
 * @param data The armor data to migrate
 * @param armorId Optional armor identifier for logging
 * @returns Migrated data at the current version
 */
export async function migrateArmorData(
	data: SerializedArmor & { version?: string },
	armorId?: string
): Promise<SerializedArmor & { version?: string }> {
	return migrateData<SerializedArmor & { version?: string }>(
		"armor",
		data,
		armorId
	);
}

