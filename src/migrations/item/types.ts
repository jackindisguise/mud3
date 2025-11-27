/**
 * Migration system types for Item objects
 *
 * Re-exported from generic types for type safety.
 */

import type { SerializedItem } from "../../core/dungeon.js";
import type {
	Migration as GenericMigration,
	MigrationInfo as GenericMigrationInfo,
} from "../generic/types.js";

/**
 * A migration function for item data
 */
export type Migration = GenericMigration<SerializedItem>;

/**
 * Migration metadata for item data
 */
export interface MigrationInfo extends GenericMigrationInfo<SerializedItem> {}


