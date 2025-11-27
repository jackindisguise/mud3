/**
 * Weapon Migration Runner
 *
 * Wrapper around the generic migration runner for weapon-specific migrations.
 */

import type { SerializedWeapon } from "../../core/dungeon.js";
import { migrateData } from "../generic/runner.js";
// Import migrations to register them
import "./index.js";

/**
 * Migrate weapon data from its current version to the latest version.
 * If the data is already at the current version, returns it unchanged.
 *
 * @param data The weapon data to migrate
 * @param weaponId Optional weapon identifier for logging
 * @returns Migrated data at the current version
 */
export async function migrateWeaponData(
	data: SerializedWeapon & { version?: string },
	weaponId?: string
): Promise<SerializedWeapon & { version?: string }> {
	return migrateData<SerializedWeapon & { version?: string }>(
		"weapon",
		data,
		weaponId
	);
}

