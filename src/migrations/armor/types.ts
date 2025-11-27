/**
 * Migration system types for Armor objects
 *
 * Re-exported from generic types for type safety.
 */

import type { SerializedArmor } from "../../core/dungeon.js";
import type {
	Migration as GenericMigration,
	MigrationInfo as GenericMigrationInfo,
} from "../generic/types.js";

/**
 * A migration function for armor data
 */
export type Migration = GenericMigration<SerializedArmor>;

/**
 * Migration metadata for armor data
 */
export interface MigrationInfo extends GenericMigrationInfo<SerializedArmor> {}

