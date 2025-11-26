import logger from "../logger.js";
import { Board } from "../board.js";

/**
 * Global registry of loaded boards.
 * Maps board names (sanitized) to their Board instances.
 */
const boardRegistry: Map<string, Board> = new Map();
const READONLY_BOARD_REGISTRY: ReadonlyMap<string, Board> = boardRegistry;
export { READONLY_BOARD_REGISTRY as BOARD_REGISTRY };

/**
 * Sanitize board name for use as registry key.
 * Allows alphanumerics, underscore, hyphen. Replaces others with underscore.
 */
function sanitizeBoardName(name: string): string {
	return name
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9_-]/gi, "_");
}

/**
 * Get the registry key for a board name.
 */
function getRegistryKey(name: string): string {
	return sanitizeBoardName(name);
}

/**
 * Get the board registry.
 * @returns The board registry
 */
export function getBoardRegistry(): ReadonlyMap<string, Board> {
	return boardRegistry;
}

/**
 * Register a board in the global registry.
 * @param board The board to register
 * @returns The registered board
 */
export function registerBoard(board: Board): Board {
	const key = getRegistryKey(board.name);
	const previous = boardRegistry.get(key);
	if (previous) {
		logger.warn(`Overriding existing board with name "${board.name}"`);
	}
	boardRegistry.set(key, board);
	logger.debug(`Registered board "${board.name}" in registry`);
	return board;
}

/**
 * Get a board by its name.
 * @param name The board name to look up
 * @returns The board or undefined if not found
 */
export function getBoard(name: string): Board | undefined {
	return boardRegistry.get(getRegistryKey(name));
}

/**
 * Get all registered boards.
 * @returns Array of all boards
 */
export function getAllBoards(): ReadonlyArray<Board> {
	return Array.from(boardRegistry.values());
}

/**
 * Get all registered boards (alias for getAllBoards).
 * @returns Array of all boards
 */
export function getBoards(): Board[] {
	return Array.from(boardRegistry.values());
}

/**
 * Check if a board is registered.
 * @param name The board name to check
 * @returns True if the board is registered
 */
export function hasBoard(name: string): boolean {
	return boardRegistry.has(getRegistryKey(name));
}

/**
 * Clear all registered boards.
 * Primarily used for testing.
 */
export function clearBoards(): void {
	boardRegistry.clear();
	logger.debug("Cleared all boards");
}

/**
 * Get the total number of registered boards.
 */
export function getBoardCount(): number {
	return boardRegistry.size;
}
