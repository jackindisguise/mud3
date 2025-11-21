/**
 * Package: character - YAML persistence for Characters
 *
 * Persists `Character` entities to `data/characters/<username>.yaml` and
 * restores them back, using the `Character.serialize()`/`deserialize()`
 * helpers from the core model.
 *
 * Behavior
 * - Filenames are derived from a sanitized, lowercased username
 * - On save, directories are created as needed; YAML is written without
 *   references and with a wide line width for readability
 * - On load, returns `undefined` if the character file doesn't exist
 *
 * Active registry (local lock)
 * - This package maintains a lightweight registry of characters considered
 *   "active" (currently in-game). Use it to prevent duplicate loads/logins.
 * - `loadCharacter()` automatically registers the character if successfully
 *   loaded and not already active.
 * - Exported helpers let the game start/stop tracking explicitly:
 *   - `registerActiveCharacter(character)`
 *   - `unregisterActiveCharacter(username)`
 * - `isCharacterActive(username)` / `getActiveCharacters()`
 *
 * Authentication helpers
 * - `checkCharacterPassword(username, password)` - Verify password without full deserialization
 * - `loadCharacterFromSerialized(data)` - Load from already-verified serialized data
 *
 * @example
 * import characterPkg, { saveCharacter, loadCharacter, checkCharacterPassword, loadCharacterFromSerialized } from './package/character.js';
 * await characterPkg.loader();
 * await saveCharacter(player);
 * const reloaded = await loadCharacter(player.credentials.username);
 * // Efficient authentication:
 * const serialized = await checkCharacterPassword('username', 'password');
 * if (serialized) {
 *   const char = loadCharacterFromSerialized(serialized);
 * }
 *
 * @module package/character
 */
import { join, relative } from "path";
import {
	mkdir,
	readFile,
	writeFile,
	access,
	rename,
	unlink,
} from "fs/promises";
import { constants as FS_CONSTANTS } from "fs";
import logger from "../logger.js";
import { Character, SerializedCharacter } from "../character.js";
import archetypePkg, { getRaceById, getJobById } from "../package/archetype.js";
import YAML from "js-yaml";
import { Package } from "package-loader";
import { getSafeRootDirectory } from "../utils/path.js";

const ROOT_DIRECTORY = getSafeRootDirectory();
const DATA_DIRECTORY = join(ROOT_DIRECTORY, "data");
const CHAR_DIR = join(DATA_DIRECTORY, "characters");

// --- Active character registry (local lock) ---
type ActiveEntry = { character: Character; since: Date };
const ACTIVE_REGISTRY: Map<string, ActiveEntry> = new Map();
const ACTIVE_ID_REGISTRY: Map<number, Character> = new Map();

function normalizeUsernameKey(username: string): string {
	return username.trim().toLowerCase();
}

/**
 * Register a character as active (in-game). Returns false if already active.
 */
export function registerActiveCharacter(character: Character): boolean {
	const key = normalizeUsernameKey(character.credentials.username);
	if (ACTIVE_REGISTRY.has(key)) return false;
	ACTIVE_REGISTRY.set(key, { character, since: new Date() });
	ACTIVE_ID_REGISTRY.set(character.credentials.characterId, character);
	logger.debug(
		`Registered active character: ${character.credentials.username} (ID: ${character.credentials.characterId})`
	);
	return true;
}

/**
 * Remove an active character entry. Returns true if an entry existed.
 */
export function unregisterActiveCharacter(username: string): boolean;
export function unregisterActiveCharacter(character: Character): boolean;
export function unregisterActiveCharacter(arg: string | Character): boolean {
	const username = typeof arg === "string" ? arg : arg.credentials.username;
	const key = normalizeUsernameKey(username);
	const entry = ACTIVE_REGISTRY.get(key);
	const removed = ACTIVE_REGISTRY.delete(key);
	if (removed && entry) {
		ACTIVE_ID_REGISTRY.delete(entry.character.credentials.characterId);
		logger.debug(`Unregistered active character: ${username}`);
	}
	return removed;
}

/** Check whether a username is currently active. */
export function isCharacterActive(username: string): boolean {
	return ACTIVE_REGISTRY.has(normalizeUsernameKey(username));
}

/** Get currently active Character instances. */
export function getActiveCharacters(): Character[] {
	return Array.from(ACTIVE_REGISTRY.values()).map((e) => e.character);
}

/**
 * Get a logged-in character by their character ID.
 *
 * @param characterId - The character ID to look up
 * @returns The Character instance if found and active, undefined otherwise
 */
export function getCharacterById(characterId: number): Character | undefined {
	return ACTIVE_ID_REGISTRY.get(characterId);
}

function sanitizeUsername(username: string): string {
	// Allow alphanumerics, underscore, hyphen. Replace others with underscore.
	return username
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9_-]/gi, "_");
}

function getCharacterFilePath(username: string): string {
	const safe = sanitizeUsername(username);
	return join(CHAR_DIR, `${safe}.yaml`);
}

async function ensureDir() {
	await mkdir(CHAR_DIR, { recursive: true });
}

async function fileExists(path: string): Promise<boolean> {
	try {
		await access(path, FS_CONSTANTS.F_OK);
		return true;
	} catch {
		return false;
	}
}

export async function saveCharacter(character: Character) {
	const data: SerializedCharacter = character.serialize();
	const filePath = getCharacterFilePath(character.credentials.username);
	const tempPath = `${filePath}.tmp`;
	const yaml = YAML.dump(data as any, { noRefs: true, lineWidth: 120 });

	try {
		// Write to temporary file first
		await writeFile(tempPath, yaml, "utf-8");

		// Atomically rename temp file to final location
		await rename(tempPath, filePath);

		logger.debug(
			`Saved character file: ${relative(ROOT_DIRECTORY, filePath)} for ${
				character.credentials.username
			}`
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

export async function characterExists(username: string): Promise<boolean> {
	const filePath = getCharacterFilePath(username);
	return await fileExists(filePath);
}

/**
 * Check if a password matches the character's stored password hash.
 * Returns the serialized character data if the password matches, undefined otherwise.
 *
 * @param username The username to check
 * @param password The plaintext password to verify
 * @returns SerializedCharacter if password matches, undefined otherwise
 */
export async function checkCharacterPassword(
	username: string,
	password: string
): Promise<SerializedCharacter | undefined> {
	const filePath = getCharacterFilePath(username);

	if (!(await characterExists(username))) {
		logger.debug(
			`Character file not found: ${relative(
				ROOT_DIRECTORY,
				filePath
			)} (username=${username})`
		);
		return undefined;
	}

	const content = await readFile(filePath, "utf-8");
	const raw = YAML.load(content) as SerializedCharacter;

	// Hash the input password and compare with stored hash
	const hashedPassword = Character.hashPassword(password);
	if (raw.credentials.passwordHash !== hashedPassword) {
		logger.debug(`Password mismatch for user: ${username}`);
		return undefined;
	}

	return raw;
}

/**
 * Load a character from serialized data and register it as active.
 *
 * @param data The serialized character data
 * @returns The deserialized Character instance
 */
export function loadCharacterFromSerialized(
	data: SerializedCharacter
): Character {
	const character = Character.deserialize(data);
	// Auto-register as active upon successful load
	registerActiveCharacter(character);
	return character;
}

export async function loadCharacter(
	username: string
): Promise<Character | undefined> {
	const filePath = getCharacterFilePath(username);
	// Prevent duplicate loads if this character is already active
	if (isCharacterActive(username)) {
		logger.warn(
			`Refusing to load character '${username}': character is already active`
		);
		return undefined;
	}
	if (!(await characterExists(username))) {
		logger.debug(
			`Character file not found: ${relative(
				ROOT_DIRECTORY,
				filePath
			)} (username=${username})`
		);
		return undefined;
	}

	const content = await readFile(filePath, "utf-8");
	const raw = YAML.load(content) as SerializedCharacter;

	const character = Character.deserialize(raw);
	// Auto-register as active upon successful load
	registerActiveCharacter(character);
	return character;
}

// Optional package object for package-loader compatibility
export default {
	name: "character",
	dependencies: [archetypePkg],
	loader: async () => {
		await logger.block("character", async () => {
			logger.debug(
				`Character storage directory ready: ${relative(
					ROOT_DIRECTORY,
					CHAR_DIR
				)}`
			);
		});
	},
} as Package;
