/**
 * Package: locations - Location configuration loader
 *
 * Loads `data/locations.yaml` (creating it with sensible defaults if missing),
 * and updates the locations registry.
 *
 * Behavior
 * - Reads YAML from `data/locations.yaml`
 * - If the file is absent/unreadable, writes default locations to disk
 * - Validates that all location references point to existing rooms
 *
 * @example
 * import locationsPkg from './package/locations.js';
 * import { getLocation, LOCATION } from '../registry/locations.js';
 * await locationsPkg.loader();
 * const startingRoom = getLocation(LOCATION.START);
 *
 * @module package/locations
 */
import { Package } from "package-loader";
import { getRoomByRef } from "../dungeon.js";
import { join, relative } from "path";
import { readFile, writeFile, rename, unlink } from "fs/promises";
import YAML from "js-yaml";
import logger from "../logger.js";
import { getSafeRootDirectory } from "../utils/path.js";
import {
	Locations,
	LOCATIONS_DEFAULT,
	setLocations,
} from "../registry/locations.js";

const ROOT_DIRECTORY = getSafeRootDirectory();
const DATA_DIRECTORY = join(ROOT_DIRECTORY, "data");
const LOCATIONS_PATH = join(DATA_DIRECTORY, "locations.yaml");

type LocationKey = "start" | "recall" | "graveyard";

export async function loadLocations() {
	logger.debug(
		`Loading locations from ${relative(ROOT_DIRECTORY, LOCATIONS_PATH)}`
	);
	try {
		const content = await readFile(LOCATIONS_PATH, "utf-8");
		const parsed = YAML.load(content) as Partial<Locations> | undefined;
		const locations = parsed ?? {};
		const safe: Locations = { ...LOCATIONS_DEFAULT };

		// merge location config
		for (const key of Object.keys(locations) as Array<keyof Locations>) {
			if (key in LOCATIONS_DEFAULT) {
				if (safe[key] === locations[key]) {
					logger.debug(`DEFAULT ${key} = ${locations[key]}`);
					continue;
				}
				safe[key] = locations[key] as string;
				logger.debug(`Set ${key} = ${locations[key]}`);
			}
		}

		// Validate that all locations reference actual rooms
		const invalidLocations: string[] = [];
		for (const [key, roomRef] of Object.entries(safe) as Array<
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

		setLocations(safe);
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
	loader: async () => {
		// read locations.yaml
		await logger.block("locations", async () => {
			await loadLocations();
		});
	},
} as Package;
