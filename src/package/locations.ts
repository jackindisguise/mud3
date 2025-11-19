/**
 * Package: locations - Location configuration loader
 *
 * Loads `data/locations.yaml` (creating it with sensible defaults if missing),
 * and provides accessors to find locations by their key.
 *
 * Behavior
 * - Reads YAML from `data/locations.yaml`
 * - If the file is absent/unreadable, writes default locations to disk
 * - Provides typed accessors for location keys
 *
 * @example
 * import locationsPkg, { getLocation, LOCATION } from './package/locations.js';
 * await locationsPkg.loader();
 * const startingRoom = getLocation(LOCATION.START);
 *
 * @module package/locations
 */
import { Package } from "package-loader";
import dungeonPkg from "./dungeon.js";
import { getRoomByRef, Room } from "../dungeon.js";
import { join, relative } from "path";
import { readFile, writeFile, rename, unlink } from "fs/promises";
import YAML from "js-yaml";
import logger from "../logger.js";

const DATA_DIRECTORY = join(process.cwd(), "data");
const LOCATIONS_PATH = join(DATA_DIRECTORY, "locations.yaml");

/**
 * Enum for location keys.
 * Provides type-safe access to location references.
 */
export const enum LOCATION {
	START = "start",
	RECALL = "recall",
	GRAVEYARD = "graveyard",
}

type LocationKey = "start" | "recall" | "graveyard";

export type LocationsConfig = {
	start: string;
	recall: string;
	graveyard: string;
};

export const LOCATIONS_DEFAULT: LocationsConfig = {
	start: "@tower{0,0,0}",
	recall: "@tower{0,0,0}",
	graveyard: "@tower{0,0,0}",
} as const;

// make a copy of the default, don't reference it directly plz
export const LOCATIONS: LocationsConfig = {
	...LOCATIONS_DEFAULT,
};

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
export function getAllLocationRefs(): LocationsConfig {
	return { ...LOCATIONS };
}

export async function loadLocations() {
	logger.debug(
		`Loading locations from ${relative(process.cwd(), LOCATIONS_PATH)}`
	);
	try {
		const content = await readFile(LOCATIONS_PATH, "utf-8");
		const parsed = YAML.load(content) as Partial<LocationsConfig> | undefined;
		const locations = parsed ?? {};

		// merge location config
		for (const key of Object.keys(locations) as Array<keyof LocationsConfig>) {
			if (key in LOCATIONS_DEFAULT) {
				if (LOCATIONS[key] === locations[key]) {
					logger.debug(`DEFAULT ${key} = ${locations[key]}`);
					continue;
				}
				LOCATIONS[key] = locations[key] as string;
				logger.debug(`Set ${key} = ${locations[key]}`);
			}
		}

		// Validate that all locations reference actual rooms
		const invalidLocations: string[] = [];
		for (const [key, roomRef] of Object.entries(LOCATIONS) as Array<
			[LocationKey, string]
		>) {
			const room = getRoomByRef(roomRef);
			if (!room) {
				invalidLocations.push(`${key}: ${roomRef}`);
			}
		}

		if (invalidLocations.length > 0) {
			throw new Error(
				`Invalid location references found:\n${invalidLocations.join(
					"\n"
				)}\n\n` +
					`All locations must reference existing rooms in the format @dungeon-id{x,y,z}`
			);
		}

		logger.info("Locations loaded successfully");
	} catch (error) {
		// Check if this is a validation error (should be re-thrown)
		if (
			error instanceof Error &&
			error.message.includes("Invalid location references")
		) {
			throw error;
		}

		// if file can't be read or doesn't exist, save default locations
		logger.debug(
			`Locations file not found or unreadable, creating default at ${LOCATIONS_PATH}`
		);
		const defaultContent = YAML.dump(LOCATIONS_DEFAULT, {
			noRefs: true,
			lineWidth: 120,
		});
		const tempPath = `${LOCATIONS_PATH}.tmp`;
		try {
			// Write to temporary file first
			await writeFile(tempPath, defaultContent, "utf-8");
			// Atomically rename temp file to final location
			await rename(tempPath, LOCATIONS_PATH);
			logger.debug("Default locations file created");
		} catch (writeError) {
			// Clean up temp file if it exists
			try {
				await unlink(tempPath);
			} catch {
				// Ignore cleanup errors
			}
			throw writeError;
		}
	}
}

export default {
	name: "locations",
	dependencies: [dungeonPkg],
	loader: async () => {
		// read locations.yaml
		await logger.block("locations", async () => {
			await loadLocations();
		});
	},
} as Package;
