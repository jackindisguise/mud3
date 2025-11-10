/**
 * Package: gamestate - YAML persistence for Game Runtime State
 *
 * Persists game runtime state (elapsed time) to `data/gamestate.yaml` and
 * restores it on startup, allowing the game to maintain continuity across
 * server restarts.
 *
 * Behavior
 * - Stores total elapsed game time in milliseconds
 * - On save, writes YAML without references and with a wide line width for readability
 * - On load, calculates downtime and adds it to elapsed time
 * - If the file is absent/unreadable, starts from zero
 *
 * @example
 * import gamestatePkg, { getElapsedTime, saveGameState } from './package/gamestate.js';
 * await gamestatePkg.loader();
 * const elapsed = getElapsedTime(); // milliseconds since game started
 * await saveGameState();
 *
 * @module package/gamestate
 */
import { Package } from "package-loader";
import { join, relative } from "path";
import { readFile, writeFile, rename, unlink } from "fs/promises";
import logger from "../logger.js";
import YAML from "js-yaml";

const DATA_DIRECTORY = join(process.cwd(), "data");
const GAMESTATE_PATH = join(DATA_DIRECTORY, "gamestate.yaml");

/**
 * Serialized game state structure.
 */
export interface SerializedGameState {
	/** Total elapsed game time in milliseconds */
	elapsedTime: number;
	/** Timestamp when this state was last saved (ISO string) */
	lastSaved: string;
}

export const GAME_STATE_DEFAULT: SerializedGameState = {
	elapsedTime: 0,
	lastSaved: new Date().toISOString(),
} as const;

// make a copy of the default, don't reference it directly plz
export const GAME_STATE: SerializedGameState = {
	...GAME_STATE_DEFAULT,
};

/**
 * Timestamp when the current session started (for calculating session elapsed time).
 */
let sessionStartTime: number = Date.now();

/**
 * Get the total elapsed game time in milliseconds.
 * This includes time from previous sessions plus time in the current session.
 */
export function getElapsedTime(): number {
	const sessionElapsed = Date.now() - sessionStartTime;
	return GAME_STATE.elapsedTime + sessionElapsed;
}

/**
 * Get the elapsed time since the last save.
 */
export function getSessionElapsedTime(): number {
	return Date.now() - sessionStartTime;
}

/**
 * Load game state from disk.
 * Calculates downtime and adds it to elapsed time.
 */
export async function loadGameState(): Promise<void> {
	logger.info(
		`Loading game state from ${relative(process.cwd(), GAMESTATE_PATH)}`
	);
	try {
		const content = await readFile(GAMESTATE_PATH, "utf-8");
		const parsed = YAML.load(content) as
			| Partial<SerializedGameState>
			| undefined;
		const data = parsed ?? {};

		// Merge elapsedTime
		if (data.elapsedTime !== undefined) {
			// Calculate downtime and add it to elapsed time
			const savedTime = data.lastSaved
				? new Date(data.lastSaved).getTime()
				: Date.now();
			const currentTime = Date.now();
			const downtime = currentTime - savedTime;

			// Add downtime to elapsed time
			GAME_STATE.elapsedTime = data.elapsedTime + downtime;

			logger.info(
				`Game state loaded. Server was down for ${Math.round(
					downtime / 1000
				)} seconds. Total elapsed time: ${Math.round(
					GAME_STATE.elapsedTime / 1000
				)} seconds.`
			);
		} else {
			logger.debug(`DEFAULT elapsedTime = ${GAME_STATE.elapsedTime}`);
		}

		// Merge lastSaved
		if (data.lastSaved !== undefined) {
			if (GAME_STATE.lastSaved === data.lastSaved) {
				logger.debug(`DEFAULT lastSaved = ${data.lastSaved}`);
			} else {
				GAME_STATE.lastSaved = data.lastSaved;
				logger.debug(`Set lastSaved = ${data.lastSaved}`);
			}
		}

		sessionStartTime = Date.now();
		logger.info("Game state loaded successfully");
	} catch (error: any) {
		// File doesn't exist or other error - save default gamestate
		if (error?.code === "ENOENT") {
			logger.debug(
				`Game state file not found or unreadable, creating default at ${relative(
					process.cwd(),
					GAMESTATE_PATH
				)}`
			);
			await saveGameState();
			logger.info("Default game state file created");
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
		const sessionElapsed = Date.now() - sessionStartTime;
		GAME_STATE.elapsedTime += sessionElapsed;
		sessionStartTime = Date.now(); // Reset session start

		// Update lastSaved timestamp
		GAME_STATE.lastSaved = new Date().toISOString();

		const yaml = YAML.dump(GAME_STATE, {
			noRefs: true,
			lineWidth: 120,
		});

		// Write to temporary file first
		await writeFile(tempPath, yaml, "utf-8");

		// Atomically rename temp file to final location
		await rename(tempPath, GAMESTATE_PATH);

		logger.debug(
			`Saved game state: ${relative(process.cwd(), GAMESTATE_PATH)}`
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
	},
} as Package;
