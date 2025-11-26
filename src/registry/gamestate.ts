/**
 * Registry: gamestate - centralized game state access
 *
 * Provides a centralized location for accessing game runtime state.
 * The GAME_STATE object is loaded and updated by the gamestate package.
 *
 * @module registry/gamestate
 */

import logger from "../logger.js";
import { DeepReadonly } from "../utils/types.js";

export interface SerializedGameState {
	elapsedTime: number;
	lastSaved?: string;
	nextCharacterId: number;
	nextObjectId: number;
}

export interface GameState {
	elapsedTime: number;
	lastSaved?: Date;
	nextCharacterId: number;
	nextObjectId: number;
}

export const GAME_STATE_DEFAULT: GameState = {
	elapsedTime: 0,
	nextCharacterId: 1,
	nextObjectId: 1,
} as const;

// make a copy of the default, don't reference it directly plz
const GAME_STATE: GameState = {
	...GAME_STATE_DEFAULT,
};

// export a readonly version of the game state
const READONLY_GAME_STATE: DeepReadonly<GameState> = GAME_STATE;
export { READONLY_GAME_STATE as GAME_STATE };

/**
 * Timestamp when the current session started (for calculating session elapsed time).
 */
let sessionStartTime: Date = new Date();

/**
 * Set the game state object.
 * @param state - The game state object to set.
 */
export function setGameState(state: GameState): void {
	GAME_STATE.elapsedTime = state.elapsedTime;
	GAME_STATE.lastSaved = state.lastSaved;
	GAME_STATE.nextCharacterId = state.nextCharacterId;
	GAME_STATE.nextObjectId = state.nextObjectId;
	setSessionStartTime(state.lastSaved ?? new Date());
}

/**
 * Update the last saved timestamp.
 */
export function updateLastSaved(date?: Date): void {
	const now = date ?? new Date();
	GAME_STATE.lastSaved = now;
	consumeElapsedTime(now);
	logger.debug(`Updated last saved timestamp to ${now.toISOString()}`);
}

export function consumeElapsedTime(date?: Date): void {
	const now = date ?? new Date();
	GAME_STATE.elapsedTime += getSessionElapsedTime();
	setSessionStartTime(now);
}

/**
 * Set the session start time.
 * @param time - The timestamp to set as session start
 */
export function setSessionStartTime(date: Date): void {
	const now = date ?? new Date();
	sessionStartTime = now;
}

/**
 * Get the session start time.
 * @returns The session start timestamp
 */
export function getSessionStartTime(): number {
	return sessionStartTime.getTime();
}

/**
 * Get the total elapsed game time in milliseconds.
 * This includes time from previous sessions plus time in the current session.
 */
export function getElapsedTime(): number {
	const sessionElapsed = getSessionElapsedTime();
	return GAME_STATE.elapsedTime + sessionElapsed;
}

/**
 * Get the elapsed time since the last save.
 */
export function getSessionElapsedTime(): number {
	return new Date().getTime() - sessionStartTime.getTime();
}

/**
 * Get the next available character ID and increment the counter.
 * Note: This does not save automatically - the caller should save after calling this.
 *
 * @returns The next character ID to assign
 */
export function getNextCharacterId(): number {
	const id = GAME_STATE.nextCharacterId;
	GAME_STATE.nextCharacterId++;
	return id;
}

/**
 * Get the next available object ID (OID) and increment the counter.
 * Note: This does not save automatically - the caller should save after calling this.
 *
 * @returns The next object ID to assign
 */
export function getNextObjectId(): number {
	const id = GAME_STATE.nextObjectId;
	GAME_STATE.nextObjectId++;
	return id;
}
