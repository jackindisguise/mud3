/**
 * Migration system types
 *
 * Re-exported from generic types for backward compatibility.
 * New code should use the generic types directly.
 */

import type { SerializedDungeonFormat } from "../../package/dungeon.js";
import type {
	Migration as GenericMigration,
	MigrationInfo as GenericMigrationInfo,
} from "../generic/types.js";

/**
 * A migration function for dungeon data
 */
export type Migration = GenericMigration<SerializedDungeonFormat>;

/**
 * Migration metadata for dungeon data
 */
export interface MigrationInfo
	extends GenericMigrationInfo<SerializedDungeonFormat> {}
