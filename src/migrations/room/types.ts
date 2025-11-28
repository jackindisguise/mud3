/**
 * Migration system types for Room objects
 *
 * Re-exported from generic types for type safety.
 */

import type { SerializedRoom } from "../../core/dungeon.js";
import type {
	Migration as GenericMigration,
	MigrationInfo as GenericMigrationInfo,
} from "../generic/types.js";

/**
 * A migration function for room data
 */
export type Migration = GenericMigration<SerializedRoom>;

/**
 * Migration metadata for room data
 */
export interface MigrationInfo extends GenericMigrationInfo<SerializedRoom> {}
