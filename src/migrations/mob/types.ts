/**
 * Migration system types for Mob objects
 *
 * Re-exported from generic types for type safety.
 */

import type { SerializedMob } from "../../core/dungeon.js";
import type {
	Migration as GenericMigration,
	MigrationInfo as GenericMigrationInfo,
} from "../generic/types.js";

/**
 * A migration function for mob data
 */
export type Migration = GenericMigration<SerializedMob>;

/**
 * Migration metadata for mob data
 */
export interface MigrationInfo extends GenericMigrationInfo<SerializedMob> {}
