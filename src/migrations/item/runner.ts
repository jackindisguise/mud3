/**
 * Item Migration Runner
 *
 * Wrapper around the generic migration runner for item-specific migrations.
 */

import type { SerializedItem } from "../../core/dungeon.js";
import { migrateData } from "../generic/runner.js";
// Import migrations to register them
import "./index.js";

/**
 * Migrate item data from its current version to the latest version.
 * If the data is already at the current version, returns it unchanged.
 *
 * @param data The item data to migrate
 * @param itemId Optional item identifier for logging
 * @returns Migrated data at the current version
 */
export async function migrateItemData(
	data: SerializedItem & { version?: string },
	itemId?: string
): Promise<SerializedItem & { version?: string }> {
	return migrateData<SerializedItem & { version?: string }>(
		"item",
		data,
		itemId
	);
}


