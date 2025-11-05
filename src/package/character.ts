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
import { mkdir, readFile, writeFile, access } from "fs/promises";
import { constants as FS_CONSTANTS } from "fs";
import logger from "../logger.js";
import { Character, SerializedCharacter } from "../character.js";
import YAML from "js-yaml";
import { Package } from "package-loader";

const CHAR_DIR = join(process.cwd(), "data", "characters");

// --- Active character registry (local lock) ---
type ActiveEntry = { character: Character; since: Date };
const ACTIVE_REGISTRY: Map<string, ActiveEntry> = new Map();

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
	logger.debug(
		`Registered active character: ${character.credentials.username}`
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
	const removed = ACTIVE_REGISTRY.delete(key);
	if (removed) logger.debug(`Unregistered active character: ${username}`);
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
	await ensureDir();
	const data: SerializedCharacter = character.serialize();
	const filePath = getCharacterFilePath(character.credentials.username);
	const yaml = YAML.dump(data as any, { noRefs: true, lineWidth: 120 });
	await writeFile(filePath, yaml, "utf-8");
	logger.debug(
		`Saved character file: ${relative(process.cwd(), filePath)} for ${
			character.credentials.username
		}`
	);
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
	await ensureDir();
	const filePath = getCharacterFilePath(username);

	if (!(await characterExists(username))) {
		logger.debug(
			`Character file not found: ${relative(
				process.cwd(),
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
	await ensureDir();
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
				process.cwd(),
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
	loader: async () => {
		await ensureDir();
		logger.info(
			`Character storage directory ready: ${relative(process.cwd(), CHAR_DIR)}`
		);
	},
} as Package;
