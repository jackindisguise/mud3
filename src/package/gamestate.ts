/**
 * Package: gamestate - YAML persistence for Game Runtime State
 *
 * Persists game runtime state (elapsed time and character ID counter) to
 * `data/gamestate.yaml` and restores it on startup, allowing the game to
 * maintain continuity across server restarts.
 *
 * Behavior
 * - Stores total elapsed game time in milliseconds
 * - Stores next character ID to assign (for unique character identification)
 * - On save, writes YAML without references and with a wide line width for readability
 * - On load, calculates downtime and adds it to elapsed time
 * - If the file is absent/unreadable, starts from zero elapsed time and ID 1
 *
 * @example
 * import gamestatePkg, { getElapsedTime, getNextCharacterId, saveGameState } from './package/gamestate.js';
 * import { getElapsedTime, getNextCharacterId } from '../registry/gamestate.js';
 * await gamestatePkg.loader();
 * const elapsed = getElapsedTime(); // milliseconds since game started
 * const characterId = await getNextCharacterId(); // get next unique character ID
 * await saveGameState();
 *
 * @module package/gamestate
 */
import { Package } from "package-loader";
import { join, relative } from "path";
import { readFile, writeFile, rename, unlink } from "fs/promises";
import logger from "../logger.js";
import YAML from "js-yaml";
import { getSafeRootDirectory } from "../utils/path.js";
import {
	GAME_STATE,
	GAME_STATE_DEFAULT,
	type SerializedGameState,
	setGameState,
	setSessionStartTime,
	getNextCharacterId as getNextCharacterIdFromRegistry,
	getNextObjectId as getNextObjectIdFromRegistry,
	updateLastSaved,
	GameState,
} from "../registry/gamestate.js";

export type { SerializedGameState };
export { GAME_STATE, GAME_STATE_DEFAULT };

const ROOT_DIRECTORY = getSafeRootDirectory();
const DATA_DIRECTORY = join(ROOT_DIRECTORY, "data");
const GAMESTATE_PATH = join(DATA_DIRECTORY, "gamestate.yaml");

/**
 * Get the next available character ID and increment the counter.
 * This function is thread-safe in the sense that it atomically
 * reads, increments, and saves the ID.
 *
 * @returns The next character ID to assign
 */
export async function getNextCharacterId(): Promise<number> {
	const id = getNextCharacterIdFromRegistry();
	await saveGameState();
	return id;
}

/**
 * Get the next available object ID (OID) and increment the counter.
 * This function is thread-safe in the sense that it atomically
 * reads, increments, and saves the ID.
 *
 * @returns The next object ID to assign
 */
export async function getNextObjectId(): Promise<number> {
	const id = getNextObjectIdFromRegistry();
	await saveGameState();
	return id;
}

/**
 * Load game state from disk.
 * Calculates downtime and adds it to elapsed time.
 */
export async function loadGameState(): Promise<void> {
	logger.debug(
		`Loading game state from ${relative(ROOT_DIRECTORY, GAMESTATE_PATH)}`
	);
	try {
		const content = await readFile(GAMESTATE_PATH, "utf-8");
		const parsed = YAML.load(content) as
			| Partial<SerializedGameState>
			| undefined;
		const data = parsed ?? {};

		const safe: GameState = { ...GAME_STATE_DEFAULT };

		// Merge elapsedTime
		if (data.elapsedTime !== undefined) {
			// Calculate downtime and add it to elapsed time
			const savedTime = data.lastSaved
				? new Date(data.lastSaved).getTime()
				: Date.now();
			const currentTime = Date.now();
			const downtime = currentTime - savedTime;

			// Add downtime to elapsed time
			safe.elapsedTime = data.elapsedTime + downtime;

			logger.debug(
				`Game state loaded. Server was down for ${Math.round(
					downtime / 1000
				)} seconds. Total elapsed time: ${Math.round(
					safe.elapsedTime / 1000
				)} seconds.`
			);
		} else {
			logger.debug(`DEFAULT elapsedTime = ${safe.elapsedTime}`);
		}

		// Merge lastSaved
		if (data.lastSaved !== undefined) {
			const lastSaved = new Date(data.lastSaved);
			safe.lastSaved = lastSaved;
			logger.debug(`Set lastSaved = ${data.lastSaved}`);
		}

		// Merge nextCharacterId
		if (data.nextCharacterId !== undefined) {
			safe.nextCharacterId = data.nextCharacterId;
			logger.debug(`Loaded nextCharacterId = ${safe.nextCharacterId}`);
		} else {
			logger.debug(`DEFAULT nextCharacterId = ${safe.nextCharacterId}`);
		}

		// Merge nextObjectId
		if (data.nextObjectId !== undefined) {
			safe.nextObjectId = data.nextObjectId;
			logger.debug(`Loaded nextObjectId = ${safe.nextObjectId}`);
		} else {
			logger.debug(`DEFAULT nextObjectId = ${safe.nextObjectId}`);
		}

		setGameState(safe);
		logger.info("Game state loaded successfully");
	} catch (error: any) {
		// File doesn't exist or other error - save default gamestate
		if (error?.code === "ENOENT") {
			logger.debug(
				`Game state file not found or unreadable, creating default at ${relative(
					ROOT_DIRECTORY,
					GAMESTATE_PATH
				)}`
			);
			await saveGameState();
			logger.debug("Default game state file created");
		} else {
			logger.error(`Failed to load game state: ${error}`);
		}
	}
}

/**
 * Save game state to disk using atomic write (temp file + rename).
 * This prevents corruption if the process is killed during the write.
 */
export async function saveGameState() {
	const tempPath = `${GAMESTATE_PATH}.tmp`;
	try {
		// Update elapsed time with current session time before saving
		const now = new Date();
		updateLastSaved(now);

		const serialized: SerializedGameState = {
			elapsedTime: GAME_STATE.elapsedTime,
			lastSaved: GAME_STATE.lastSaved?.toISOString(),
			nextCharacterId: GAME_STATE.nextCharacterId,
			nextObjectId: GAME_STATE.nextObjectId,
		};

		const yaml = YAML.dump(serialized, {
			noRefs: true,
			lineWidth: 120,
		});

		// Write to temporary file first
		await writeFile(tempPath, yaml, "utf-8");

		// Atomically rename temp file to final location
		await rename(tempPath, GAMESTATE_PATH);

		logger.debug(
			`Saved game state: ${relative(ROOT_DIRECTORY, GAMESTATE_PATH)}`
		);
	} catch (error) {
		// Clean up temp file if it exists
		try {
			await unlink(tempPath);
		} catch {
			// Ignore cleanup errors
		}
		logger.error(`Failed to save game state: ${error}`);
	}
}

export default {
	name: "gamestate",
	loader: async () => {
		await logger.block("gamestate", async () => {
			// Clean up any leftover temp files from previous crashes
			const tempPath = `${GAMESTATE_PATH}.tmp`;
			try {
				await unlink(tempPath);
				logger.debug("Cleaned up leftover temp file from previous session");
			} catch {
				// Temp file doesn't exist, which is fine
			}

			// Load saved values from file
			await loadGameState();
		});
	},
} as Package;
