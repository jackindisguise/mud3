/**
 * Generic migration system types
 *
 * These types can be used for any data type that needs versioning and migration.
 */

/**
 * A migration function that transforms data from one version to the next.
 * The function receives the data and returns the transformed data.
 * The version field will be updated automatically after migration.
 */
export type Migration<T> = (
	data: T & { version?: string }
) => T & { version?: string };

/**
 * Migration metadata
 */
export interface MigrationInfo<T> {
	/** Version this migration migrates FROM */
	from: string;
	/** Version this migration migrates TO */
	to: string;
	/** Migration function */
	migrate: Migration<T>;
	/** Optional description of what this migration does */
	description?: string;
}
