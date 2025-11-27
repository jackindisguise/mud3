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
import { createHash } from "crypto";
import logger from "../logger.js";
import {
	nameToColor,
	COLOR,
	COLOR_NAMES,
	COLOR_NAME_TO_COLOR,
} from "../core/color.js";
import {
	Character,
	SerializedCharacter,
	MESSAGE_GROUP,
	PlayerSettings,
} from "../core/character.js";
import { SerializedMob } from "../core/dungeon.js";
import archetypePkg from "../package/archetype.js";
import { deserializeMob } from "./dungeon.js";
import YAML from "js-yaml";
import { Package } from "package-loader";
import { getSafeRootDirectory } from "../utils/path.js";
import { CONFIG } from "../registry/config.js";
import { getCurrentVersion } from "../migrations/version.js";
import { migrateCharacterData } from "../migrations/character/runner.js";

const ROOT_DIRECTORY = getSafeRootDirectory();
const DATA_DIRECTORY = join(ROOT_DIRECTORY, "data");
const CHAR_DIR = join(DATA_DIRECTORY, "characters");

/**
 * Hashes a password using SHA256 with the configured salt.
 *
 * @param password The plain text password to hash
 * @returns The SHA256 hash of the salted password
 *
 * @example
 * ```typescript
 * const hashedPassword = hashPassword("myPassword123");
 * ```
 */
export function hashPassword(password: string): string {
	const saltedPassword = password + CONFIG.security.password_salt;
	return createHash("sha256").update(saltedPassword).digest("hex");
}

/**
 * Sets a password on a character by hashing it and storing the hash.
 *
 * @param character The character to set the password for
 * @param password The plain text password to set
 *
 * @example
 * ```typescript
 * setCharacterPassword(character, "newSecurePassword123");
 * ```
 */
export function setCharacterPassword(
	character: Character,
	password: string
): void {
	character.credentials.passwordHash = hashPassword(password);
}

/**
 * Verifies a password against a character's stored password hash.
 *
 * @param character The character to verify the password for
 * @param password The plain text password to verify
 * @returns true if the password matches, false otherwise
 *
 * @example
 * ```typescript
 * if (verifyCharacterPassword(character, "myPassword")) {
 *   console.log("Password is correct");
 * }
 * ```
 */
export function verifyCharacterPassword(
	character: Character,
	password: string
): boolean {
	return character.credentials.passwordHash === hashPassword(password);
}

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
	const data: SerializedCharacter = character.serialize({
		version: await getCurrentVersion(),
	});
	const filePath = getCharacterFilePath(character.credentials.username);
	const tempPath = `${filePath}.tmp`;
	if (!data.mob) throw new Error("Character mob is required to save");

	const yaml = YAML.dump(data, {
		noRefs: true,
		lineWidth: 120,
	});

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
	const raw = YAML.load(content) as SerializedCharacter & { version?: string };

	// Hash the input password and compare with stored hash
	// Note: We don't migrate here - migration happens in deserializeCharacter
	const hashedPassword = hashPassword(password);
	if (raw.credentials.passwordHash !== hashedPassword) {
		logger.debug(`Password mismatch for user: ${username}`);
		return undefined;
	}

	// Return raw data - migration will happen when deserializing
	return raw;
}

/**
 * Deserialize a SerializedCharacter into a Character instance.
 * This is the package-layer deserializer that handles all package dependencies.
 *
 * @param data The serialized character data
 * @returns New Character instance
 */
export async function deserializeCharacter(
	data: SerializedCharacter & { version?: string }
): Promise<Character> {
	const version = data.version;
	// Migrate character data first
	const migratedData = await migrateCharacterData(
		data,
		data.credentials?.username
	);

	const mobDataWithType: SerializedMob = { ...migratedData.mob!, type: "Mob" };
	// Deserialize the mob using the package deserializer, passing character version for nested objects
	const mob = await deserializeMob(mobDataWithType, true, version);

	// Handle backward compatibility: if characterId is missing, assign a temporary one
	const characterId =
		migratedData.credentials.characterId ?? Number.MAX_SAFE_INTEGER;

	const creds = {
		characterId,
		username: migratedData.credentials.username,
		passwordHash: migratedData.credentials.passwordHash,
		email: migratedData.credentials.email,
		createdAt: new Date(migratedData.credentials.createdAt),
		lastLogin: new Date(migratedData.credentials.lastLogin),
		isActive: migratedData.credentials.isActive,
		isBanned: migratedData.credentials.isBanned,
		isAdmin: migratedData.credentials.isAdmin,
	};

	// Convert channels and blockedUsers arrays back to Sets
	const settings: PlayerSettings = {
		receiveOOC: migratedData.settings.receiveOOC,
		verboseMode: migratedData.settings.verboseMode,
		prompt: migratedData.settings.prompt,
		colorEnabled: migratedData.settings.colorEnabled,
		autoLook: migratedData.settings.autoLook,
		briefMode: migratedData.settings.briefMode,
		echoMode: migratedData.settings.echoMode,
		busyModeEnabled: migratedData.settings.busyModeEnabled,
		channels:
			migratedData.settings.channels !== undefined
				? new Set(migratedData.settings.channels)
				: new Set(),
		blockedUsers:
			migratedData.settings.blockedUsers !== undefined
				? new Set(migratedData.settings.blockedUsers)
				: undefined,
		busyForwardedGroups:
			migratedData.settings.busyForwardedGroups !== undefined
				? new Set(migratedData.settings.busyForwardedGroups)
				: new Set([MESSAGE_GROUP.CHANNELS]),
		combatBusyForwardedGroups:
			migratedData.settings.combatBusyForwardedGroups !== undefined
				? new Set(migratedData.settings.combatBusyForwardedGroups)
				: new Set([MESSAGE_GROUP.CHANNELS]),
		defaultColor:
			migratedData.settings.defaultColor !== undefined
				? COLOR_NAME_TO_COLOR[migratedData.settings.defaultColor]
				: undefined,
	};

	const character = new Character({
		credentials: creds,
		settings: settings,
		stats: migratedData.stats,
		mob,
	});

	return character;
}

/**
 * Load a character from serialized data and register it as active.
 *
 * @param data The serialized character data
 * @returns The deserialized Character instance
 */
export async function loadCharacterFromSerialized(
	data: SerializedCharacter
): Promise<Character> {
	const character = await deserializeCharacter(data);
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
	const raw = YAML.load(content) as SerializedCharacter & { version?: string };

	// Migration happens inside deserializeCharacter
	const character = await deserializeCharacter(raw);
	// Auto-register as active upon successful load
	registerActiveCharacter(character);
	return character;
}

// Optional package object for package-loader compatibility
export default {
	name: "character",
	dependencies: [archetypePkg],
	loader: async () => {
		logger.debug(
			`Character storage directory ready: ${relative(ROOT_DIRECTORY, CHAR_DIR)}`
		);
	},
} as Package;
