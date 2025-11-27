/**
 * Migration system types for Equipment objects
 *
 * Re-exported from generic types for type safety.
 */

import type { SerializedEquipment } from "../../core/dungeon.js";
import type {
	Migration as GenericMigration,
	MigrationInfo as GenericMigrationInfo,
} from "../generic/types.js";

/**
 * A migration function for equipment data
 */
export type Migration = GenericMigration<SerializedEquipment>;

/**
 * Migration metadata for equipment data
 */
export interface MigrationInfo
	extends GenericMigrationInfo<SerializedEquipment> {}

