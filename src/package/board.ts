/**
 * Package: board - YAML persistence for Message Boards
 *
 * Persists `Board` class instances to `data/boards/<name>.yaml` and
 * restores them back, using the `Board.serialize()`/`Board.deserialize()`
 * methods from the core model.
 *
 * Behavior
 * - Filenames are derived from a sanitized, lowercased board name
 * - On save, directories are created as needed; YAML is written without
 *   references and with a wide line width for readability
 * - On load, returns `undefined` if the board file doesn't exist
 *
 * @example
 * import boardPkg, { saveBoard, loadBoard, getAllBoards } from './package/board.js';
 * import { Board } from '../board.js';
 * await boardPkg.loader();
 * const board = new Board('general', 'General', 'General discussion', true);
 * await saveBoard(board);
 * const reloaded = await loadBoard('general');
 * const allBoards = await getAllBoards();
 *
 * @module package/board
 */
import { join, relative } from "path";
import {
	mkdir,
	readFile,
	writeFile,
	access,
	readdir,
	rename,
	unlink,
} from "fs/promises";
import { constants as FS_CONSTANTS } from "fs";
import logger from "../logger.js";
import { Board, SerializedBoard } from "../board.js";
import YAML from "js-yaml";
import { Package } from "package-loader";

const BOARD_DIR = join(process.cwd(), "data", "boards");

function sanitizeBoardName(name: string): string {
	// Allow alphanumerics, underscore, hyphen. Replace others with underscore.
	return name
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9_-]/gi, "_");
}

function getBoardFilePath(name: string): string {
	const safe = sanitizeBoardName(name);
	return join(BOARD_DIR, `${safe}.yaml`);
}

async function ensureDir() {
	await mkdir(BOARD_DIR, { recursive: true });
}

async function fileExists(path: string): Promise<boolean> {
	try {
		await access(path, FS_CONSTANTS.F_OK);
		return true;
	} catch {
		return false;
	}
}

/**
 * Save a board to disk using atomic write (temp file + rename).
 * This prevents corruption if the process is killed during the write.
 */
export async function saveBoard(board: Board): Promise<void> {
	await ensureDir();
	const data: SerializedBoard = board.serialize();
	const filePath = getBoardFilePath(board.name);
	const tempPath = `${filePath}.tmp`;
	const yaml = YAML.dump(data as any, { noRefs: true, lineWidth: 120 });

	try {
		// Write to temporary file first
		await writeFile(tempPath, yaml, "utf-8");

		// Atomically rename temp file to final location
		await rename(tempPath, filePath);

		logger.debug(
			`Saved board file: ${relative(process.cwd(), filePath)} for ${board.name}`
		);
	} catch (error) {
		// Clean up temp file if it exists
		try {
			await unlink(tempPath);
		} catch {
			// Ignore cleanup errors
		}
		throw error;
	}
}

/**
 * Load a board from disk.
 */
export async function loadBoard(name: string): Promise<Board | undefined> {
	const filePath = getBoardFilePath(name);
	if (!(await fileExists(filePath))) {
		return undefined;
	}

	try {
		const content = await readFile(filePath, "utf-8");
		const data = YAML.load(content) as SerializedBoard;
		return Board.deserialize(data);
	} catch (error) {
		logger.error(`Failed to load board ${name}: ${error}`);
		return undefined;
	}
}

/**
 * Check if a board exists.
 */
export async function boardExists(name: string): Promise<boolean> {
	const filePath = getBoardFilePath(name);
	return await fileExists(filePath);
}

/**
 * Get all board names from disk.
 */
export async function getAllBoardNames(): Promise<string[]> {
	await ensureDir();
	try {
		const files = await readdir(BOARD_DIR);
		return files
			.filter((file) => file.endsWith(".yaml"))
			.map((file) => file.replace(/\.yaml$/, ""));
	} catch (error) {
		logger.error(`Failed to read boards directory: ${error}`);
		return [];
	}
}

/**
 * Load all boards from disk.
 */
export async function getAllBoards(): Promise<Board[]> {
	const names = await getAllBoardNames();
	const boards: Board[] = [];

	for (const name of names) {
		const board = await loadBoard(name);
		if (board) {
			boards.push(board);
		}
	}

	return boards;
}

/**
 * Delete a board file.
 */
export async function deleteBoard(name: string): Promise<boolean> {
	const filePath = getBoardFilePath(name);
	if (!(await fileExists(filePath))) {
		return false;
	}

	try {
		const { unlink } = await import("fs/promises");
		await unlink(filePath);
		logger.debug(`Deleted board file: ${relative(process.cwd(), filePath)}`);
		return true;
	} catch (error) {
		logger.error(`Failed to delete board ${name}: ${error}`);
		return false;
	}
}

export default {
	name: "board",
	loader: async () => {
		await ensureDir();
		logger.info("Board package loaded");
	},
} as Package;
