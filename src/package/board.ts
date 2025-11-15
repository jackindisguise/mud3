/**
 * Package: board - YAML persistence for Message Boards
 *
 * Persists `Board` class instances to two separate files:
 * - `data/boards/<name>.yaml` - Board configuration
 * - `data/boards/<name>.messages.yaml` - Board messages
 *
 * Behavior
 * - Filenames are derived from a sanitized, lowercased board name
 * - On save, directories are created as needed; YAML is written without
 *   references and with a wide line width for readability
 * - On load, returns `undefined` if either board file doesn't exist
 * - Uses atomic writes (temp file + rename) to prevent corruption
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
	readFile,
	writeFile,
	access,
	readdir,
	rename,
	unlink,
} from "fs/promises";
import { constants as FS_CONSTANTS } from "fs";
import logger from "../logger.js";
import {
	Board,
	SerializedBoardConfig,
	SerializedBoardMessages,
} from "../board.js";
import YAML from "js-yaml";
import { Package } from "package-loader";

const BOARD_DIR = join(process.cwd(), "data", "boards");
const BOARD_REGISTRY = new Map<string, Board>();

function sanitizeBoardName(name: string): string {
	// Allow alphanumerics, underscore, hyphen. Replace others with underscore.
	return name
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9_-]/gi, "_");
}

function getBoardConfigFilePath(name: string): string {
	const safe = sanitizeBoardName(name);
	return join(BOARD_DIR, `${safe}.yaml`);
}

function getBoardMessagesFilePath(name: string): string {
	const safe = sanitizeBoardName(name);
	return join(BOARD_DIR, `${safe}.messages.yaml`);
}

function getRegistryKey(name: string): string {
	return sanitizeBoardName(name);
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
 * Saves board configuration and messages to separate files.
 */
export async function saveBoard(board: Board): Promise<void> {
	registerBoard(board);
	const configPath = getBoardConfigFilePath(board.name);
	const messagesPath = getBoardMessagesFilePath(board.name);
	const configTempPath = `${configPath}.tmp`;
	const messagesTempPath = `${messagesPath}.tmp`;

	const configData = board.serializeConfig();
	const messagesData = board.serializeMessages();

	const configYaml = YAML.dump(configData as any, {
		noRefs: true,
		lineWidth: 120,
	});
	const messagesYaml = YAML.dump(messagesData as any, {
		noRefs: true,
		lineWidth: 120,
	});

	logger.debug(
		`Saving board "${board.name}" to ${relative(
			process.cwd(),
			configPath
		)} (+ messages)`
	);

	try {
		// Write config to temporary file first
		await writeFile(configTempPath, configYaml, "utf-8");
		// Atomically rename temp file to final location
		await rename(configTempPath, configPath);

		// Write messages to temporary file first
		await writeFile(messagesTempPath, messagesYaml, "utf-8");
		// Atomically rename temp file to final location
		await rename(messagesTempPath, messagesPath);

		logger.debug(
			`Saved board files: ${relative(process.cwd(), configPath)} and ${relative(
				process.cwd(),
				messagesPath
			)} for ${board.name}`
		);
	} catch (error) {
		// Clean up temp files if they exist
		try {
			await unlink(configTempPath);
		} catch {
			// Ignore cleanup errors
		}
		try {
			await unlink(messagesTempPath);
		} catch {
			// Ignore cleanup errors
		}
		throw error;
	}
}

export function registerBoard(board: Board): Board {
	BOARD_REGISTRY.set(getRegistryKey(board.name), board);
	logger.debug(`Registered board "${board.name}" in registry`);
	return board;
}

export function getBoard(name: string): Board | undefined {
	return BOARD_REGISTRY.get(getRegistryKey(name));
}

export function getBoards(): Board[] {
	return Array.from(BOARD_REGISTRY.values());
}

/**
 * Load a board from disk.
 * If the messages file is missing, the board will be loaded with no messages.
 */
export async function loadBoard(name: string): Promise<Board | undefined> {
	const existing = getBoard(name);
	if (existing) {
		return existing;
	}

	const configPath = getBoardConfigFilePath(name);
	const messagesPath = getBoardMessagesFilePath(name);

	const hasConfigFile = await fileExists(configPath);

	if (!hasConfigFile) {
		return undefined;
	}

	try {
		const configContent = await readFile(configPath, "utf-8");
		const config = YAML.load(configContent) as SerializedBoardConfig;

		let messages: SerializedBoardMessages;
		const hasMessagesFile = await fileExists(messagesPath);
		if (hasMessagesFile) {
			const messagesContent = await readFile(messagesPath, "utf-8");
			messages = YAML.load(messagesContent) as SerializedBoardMessages;
		} else {
			// Messages file is missing - use empty messages
			messages = { messages: [] };
		}

		const board = Board.deserializeFromSeparate(config, messages);
		const messageCount = board.getMessageCount();
		logger.debug(
			`Loaded board "${name}" with ${messageCount} message(s) from ${relative(
				process.cwd(),
				configPath
			)}`
		);
		return registerBoard(board);
	} catch (error) {
		logger.error(`Failed to load board ${name}: ${error}`);
		return undefined;
	}
}

/**
 * Check if a board exists.
 * Only checks for the config file since messages file is optional.
 */
export async function boardExists(name: string): Promise<boolean> {
	if (getBoard(name)) {
		return true;
	}
	const configPath = getBoardConfigFilePath(name);
	return await fileExists(configPath);
}

/**
 * Get all board names from disk.
 * Looks for config files (board.yaml) and ignores message files (board.messages.yaml).
 */
export async function getAllBoardNames(): Promise<string[]> {
	try {
		const files = await readdir(BOARD_DIR);
		const boardNames = new Set<string>();

		for (const file of files) {
			if (file.endsWith(".messages.yaml")) {
				// Extract board name from messages file
				const name = file.replace(/\.messages\.yaml$/, "");
				boardNames.add(name);
			} else if (file.endsWith(".yaml") && !file.endsWith(".messages.yaml")) {
				// Check if it's a config file (not a messages file)
				const name = file.replace(/\.yaml$/, "");
				// Only add if it's not already in the set (to avoid duplicates)
				if (!boardNames.has(name)) {
					boardNames.add(name);
				}
			}
		}

		const names = Array.from(boardNames);
		logger.debug(
			`Discovered ${names.length} board config(s) under ${relative(
				process.cwd(),
				BOARD_DIR
			)}`
		);
		return names;
	} catch (error) {
		logger.error(`Failed to read boards directory: ${error}`);
		return [];
	}
}

/**
 * Load all boards from disk.
 */
export async function loadBoards(): Promise<Board[]> {
	const names = await getAllBoardNames();
	const boards: Board[] = [];

	for (const name of names) {
		const board = await loadBoard(name);
		if (board) boards.push(board);
	}

	const totalMessages = boards.reduce(
		(sum, board) => sum + board.getMessageCount(),
		0
	);
	logger.info(
		`Loaded ${boards.length} board(s) (${totalMessages} total message(s)) into registry`
	);
	return boards;
}

export default {
	name: "board",
	loader: async () => {
		await logger.block("board", async () => {
			await loadBoards();
		});
	},
} as Package;
