/**
 * Registry: locations - centralized location access
 *
 * Provides a centralized location for accessing system locations.
 * The LOCATIONS object is loaded and updated by the locations package.
 *
 * @module registry/locations
 */

import { getRoomByRef } from "../registry/dungeon.js";
import { Room } from "../core/dungeon.js";
import { DeepReadonly } from "../utils/types.js";

export { READONLY_LOCATIONS as LOCATIONS };

/**
 * Enum for location keys.
 * Provides type-safe access to location references.
 */
export const enum LOCATION {
	START = "start",
	RECALL = "recall",
	GRAVEYARD = "graveyard",
}

type LocationKey = (typeof LOCATION)[keyof typeof LOCATION];

export type Locations = {
	[key in LocationKey]: string;
};

export const LOCATIONS_DEFAULT: Locations = {
	start: "@tower{0,0,0}",
	recall: "@tower{0,0,0}",
	graveyard: "@tower{0,0,0}",
} as const;

// make a copy of the default, don't reference it directly plz
const LOCATIONS: Locations = {
	...LOCATIONS_DEFAULT,
};

// export a readonly version of the locations
const READONLY_LOCATIONS: DeepReadonly<Locations> = LOCATIONS;

/**
 * Set the locations object.
 * @param locations - The locations object to set.
 */
export function setLocations(locations: Locations): void {
	LOCATIONS.start = locations.start;
	LOCATIONS.recall = locations.recall;
	LOCATIONS.graveyard = locations.graveyard;
}

/**
 * Get a location by its key.
 * @param key The location key to retrieve (can use LOCATION enum or string)
 * @returns The Room instance for the location, or undefined if not found
 *
 * @example
 * ```typescript
 * const startingRoom = getLocation(LOCATION.START);
 * // Returns: Room instance or undefined
 *
 * const recallRoom = getLocation('recall');
 * // Also works with string keys
 * ```
 */
export function getLocation(key: LOCATION | LocationKey): Room {
	const roomRef = LOCATIONS[key as LocationKey];
	return getRoomByRef(roomRef)!;
}

/**
 * Get a location reference string by its key.
 * @param key The location key to retrieve (can use LOCATION enum or string)
 * @returns The room reference string for the location, or undefined if not found
 *
 * @example
 * ```typescript
 * const startingRoomRef = getLocationRef(LOCATION.START);
 * // Returns: "@tower{0,0,0}"
 *
 * const recallRoomRef = getLocationRef('recall');
 * // Also works with string keys
 * ```
 */
export function getLocationRef(key: LOCATION | LocationKey): string {
	return LOCATIONS[key as LocationKey]!;
}

/**
 * Get all locations as a dictionary of Room objects.
 * @returns A dictionary mapping location keys to Room instances
 *
 * @example
 * ```typescript
 * const locations = getAllLocations();
 * const startingRoom = locations[LOCATION.START];
 * ```
 */
export function getAllLocations(): Record<LocationKey, Room> {
	return {
		start: getLocation(LOCATION.START),
		recall: getLocation(LOCATION.RECALL),
		graveyard: getLocation(LOCATION.GRAVEYARD),
	};
}

/**
 * Get all location reference strings as a dictionary.
 * @returns A copy of the locations configuration with reference strings
 *
 * @example
 * ```typescript
 * const locationRefs = getAllLocationRefs();
 * const startingRoomRef = locationRefs[LOCATION.START];
 * // Returns: "@tower{9,19,0}"
 * ```
 */
export function getAllLocationRefs(): Locations {
	return { ...LOCATIONS };
}
