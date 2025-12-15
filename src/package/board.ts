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
 * Registry helpers are exported from `src/registry/board.ts` and are used
 * by gameplay systems to look up boards at runtime.
 *
 * @example
 * import boardPkg, { saveBoard, loadBoard } from './package/board.js';
 * import { Board } from '../board.js';
 * import { getBoard, getAllBoards } from './registry/board.js';
 * await boardPkg.loader();
 * const board = new Board('general', 'General', 'General discussion', true);
 * await saveBoard(board);
 * const reloaded = await loadBoard('general');
 * const allBoards = getAllBoards();
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
import logger from "../utils/logger.js";
import {
	Board,
	SerializedBoard,
	SerializedBoardConfig,
	SerializedBoardMessages,
} from "../core/board.js";
import YAML from "js-yaml";
import { Package } from "package-loader";
import { getSafeRootDirectory } from "../utils/path.js";
import { registerBoard, getBoard } from "../registry/board.js";

const ROOT_DIRECTORY = getSafeRootDirectory();
const DATA_DIRECTORY = join(ROOT_DIRECTORY, "data");
const BOARD_DIR = join(DATA_DIRECTORY, "boards");

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
			ROOT_DIRECTORY,
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
			`Saved board files: ${relative(
				ROOT_DIRECTORY,
				configPath
			)} and ${relative(ROOT_DIRECTORY, messagesPath)} for ${board.name}`
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

/**
 * Deserialize a Board from serialized data.
 * This is the package-layer deserializer that handles all package dependencies.
 *
 * @param data The serialized board data
 * @returns New Board instance
 */
export function deserializeBoard(data: SerializedBoard): Board {
	const board = new Board(
		data.name,
		data.displayName,
		data.description,
		data.permanent,
		data.expirationMs,
		data.writePermission || "all"
	);
	board.setMessages(data.messages);
	board.setNextMessageId(data.nextMessageId);
	return board;
}

/**
 * Deserialize a Board from separate config and messages data.
 * This is the package-layer deserializer that handles all package dependencies.
 *
 * @param config The serialized board configuration
 * @param messages The serialized board messages
 * @returns New Board instance
 */
export function deserializeBoardFromSeparate(
	config: SerializedBoardConfig,
	messages: SerializedBoardMessages
): Board {
	const board = new Board(
		config.name,
		config.displayName,
		config.description,
		config.permanent,
		config.expirationMs,
		config.writePermission || "all"
	);
	// Ensure all messages have a subject (for backward compatibility)
	board.setMessages(messages.messages);
	board.setNextMessageId(config.nextMessageId);
	return board;
}

/**
 * Marks a message as read by a character ID and saves the board.
 * This is the package-layer function that handles persistence.
 *
 * @param board The board containing the message
 * @param messageId The message ID to mark as read
 * @param characterId The character ID that read the message
 * @returns True if the message was found and marked, false otherwise
 */
export async function markMessageAsReadAndSave(
	board: Board,
	messageId: number,
	characterId: number
): Promise<boolean> {
	const marked = board.markMessageAsRead(messageId, characterId);
	if (marked) {
		// Save the board to persist the read status
		await saveBoard(board).catch((err) => {
			logger.error(
				`Failed to save board after marking message as read: ${err}`
			);
		});
	}
	return marked;
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

		const board = deserializeBoardFromSeparate(config, messages);
		const messageCount = board.getMessageCount();
		logger.debug(
			`Loaded board "${name}" with ${messageCount} message(s) from ${relative(
				ROOT_DIRECTORY,
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
				ROOT_DIRECTORY,
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
		await loadBoards();
	},
} as Package;
