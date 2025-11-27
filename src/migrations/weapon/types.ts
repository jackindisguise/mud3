/**
 * Migration system types for Weapon objects
 *
 * Re-exported from generic types for type safety.
 */

import type { SerializedWeapon } from "../../core/dungeon.js";
import type {
	Migration as GenericMigration,
	MigrationInfo as GenericMigrationInfo,
} from "../generic/types.js";

/**
 * A migration function for weapon data
 */
export type Migration = GenericMigration<SerializedWeapon>;

/**
 * Migration metadata for weapon data
 */
export interface MigrationInfo extends GenericMigrationInfo<SerializedWeapon> {}


