/**
 * Provides the `Character` class (a player's persistent profile and runtime session),
 * message grouping utilities, sane defaults for new players, and serialization helpers.
 * It is the primary integration point between authentication/session state and the
 * world model (`Mob` in `dungeon.ts`).
 *
 * What you get
 * - `Character`: persistent credentials, settings, and stats + runtime session handling
 * - `MESSAGE_GROUP`: controls how messages are grouped to show prompts cleanly
 * - `CHANNEL`: enum of predefined communication channels
 * - `CHANNELS`: array of all channel values for runtime reference
 * - Defaults: `DEFAULT_PLAYER_SETTINGS`, `DEFAULT_PLAYER_CREDENTIALS`, `DEFAULT_PLAYER_STATS`
 * - Types: `PlayerSettings`, `PlayerCredentials`, `PlayerStats`, `PlayerSession`,
 *   `CharacterOptions`, `SerializedCharacter`, and related helpers
 * - Utilities: `Character.hashPassword()`, `character.serialize()` and `Character.deserialize()`
 *
 * Typical usage
 * ```ts
 * import { Character, MESSAGE_GROUP } from "./character.js";
 * import { MudClient } from "./io.js";
 * import { Mob } from "./dungeon.js";
 *
 * // 1) Create a character (only username is required)
 * const hero = new Character({
 *   credentials: { username: "alice" },
 *   mob: new Mob(),
 * });
 *
 * // 2) Set a password (stored as a salted SHA-256 hash)
 * hero.setPassword("super-secret");
 *
 * // 3) Start a session when a client connects
 * // const client: MudClient = ... (created by the game server)
 * // hero.startSession(42, client);
 *
 * // 4) Send messages (prompt will be emitted on group changes)
 * hero.sendMessage("Welcome to the realm!", MESSAGE_GROUP.SYSTEM);
 *
 * // 5) Serialize to save; deserialize to restore later
 * const data = hero.serialize();
 * const restored = Character.deserialize(data);
 *
 * // 6) End the session on disconnect
 * // hero.endSession();
 * ```
 *
 * Notes
 * - Password hashing uses `CONFIG.security.password_salt` - ensure it is configured.
 * - `Character.mob` establishes a bidirectional link with `Mob.character` so the
 *   in-world entity can reference its player (and vice versa).
 * - `serialize()` returns a plain object suitable for JSON/YAML persistence; runtime
 *   fields like the active session and MudClient are intentionally excluded.
 * @module character
 */

import { Mob, SerializedMob } from "./dungeon.js";
import { createHash } from "crypto";
import { CONFIG } from "./package/config.js";
import type { MudClient } from "./io.js";
import { CHANNEL, formatChannelMessage } from "./channel.js";
import { isLocalhost } from "./io.js";
import { LINEBREAK } from "./telnet.js";

/**
 * Message groups categorize outbound messages and control prompt emission.
 * If a message arrives with a different group than the previous one, the client
 * receives a blank line followed by the prompt to visually separate contexts.
 */
export enum MESSAGE_GROUP {
	INFO = "INFO",
	COMBAT = "COMBAT",
	COMMAND_RESPONSE = "COMMAND_RESPONSE",
	SYSTEM = "SYSTEM",
	CHANNELS = "CHANNELS",
}

/**
 * Player-specific settings and configuration.
 */
export interface PlayerSettings {
	/** Whether to receive out-of-character (OOC) messages */
	receiveOOC?: boolean;
	/** Whether to show verbose room descriptions */
	verboseMode?: boolean;
	/** Preferred command prompt format */
	prompt?: string;
	/** Color preferences */
	colorEnabled?: boolean;
	/** Auto-look after movement */
	autoLook?: boolean;
	/** Brief mode for room descriptions */
	briefMode?: boolean;
	/** Channels the player is subscribed to */
	channels?: Set<CHANNEL>;
	/** Set of blocked usernames (players who cannot send messages to this character) */
	blockedUsers?: Set<string>;
}

/**
 * Default channels that new characters are subscribed to.
 * Players start subscribed to OOC, GOSSIP, SAY, and WHISPER channels by default.
 * They must opt-in to NEWBIE and TRADE channels.
 */
export const DEFAULT_CHANNELS: readonly CHANNEL[] = [
	CHANNEL.OOC,
	CHANNEL.GOSSIP,
	CHANNEL.SAY,
	CHANNEL.WHISPER,
] as const;

/**
 * Default player settings applied to new characters.
 *
 * @example
 * ```ts
 * // Default values
 * const DEFAULT_PLAYER_SETTINGS: PlayerSettings = {
 *   receiveOOC: true,
 *   verboseMode: true,
 *   prompt: "> ",
 *   colorEnabled: true,
 *   autoLook: true,
 *   briefMode: false,
 *   channels: new Set<string>(),
 * };
 * ```
 */
export const DEFAULT_PLAYER_SETTINGS: PlayerSettings = {
	receiveOOC: true,
	verboseMode: true,
	prompt: "> ",
	colorEnabled: true,
	autoLook: true,
	briefMode: false,
} as const;

/**
 * Authentication and account information (runtime form).
 *
 * Note: `createdAt` and `lastLogin` are Date objects in memory. When persisted,
 * these become ISO strings via `SerializedPlayerCredentials`.
 */
export interface PlayerCredentials {
	/** Player's username/login name */
	username: string;
	/** Hashed password (never store plain text) */
	passwordHash: string;
	/** Email address for account recovery */
	email?: string;
	/** Account creation timestamp */
	createdAt: Date;
	/** Last login timestamp (updated by startSession) */
	lastLogin: Date;
	/** Character is active / playable */
	isActive: boolean;
	/** Character is banned */
	isBanned: boolean;
	/** Character is an admin */
	isAdmin: boolean;
}

/**
 * Default credential flags for new accounts.
 *
 * @example
 * ```ts
 * // Default flags
 * const DEFAULT_PLAYER_CREDENTIALS: Pick<PlayerCredentials, "isActive" | "isBanned" | "isAdmin"> = {
 *   isActive: true,
 *   isBanned: false,
 *   isAdmin: false,
 * };
 * // Other fields are set by Character constructor:
 * // passwordHash: "", createdAt: now, lastLogin: now
 * ```
 */
export const DEFAULT_PLAYER_CREDENTIALS: Pick<
	PlayerCredentials,
	"isActive" | "isBanned" | "isAdmin"
> = {
	isActive: true,
	isBanned: false,
	isAdmin: false,
} as const;

/**
 * Character progression and gameplay statistics.
 */
export interface PlayerStats {
	/** Total time played in milliseconds */
	playtime: number;
	/** Number of times the character has died */
	deaths: number;
	/** Number of mobs defeated */
	kills: number;
}

/**
 * Default player statistics for new characters.
 *
 * @example
 * ```ts
 * // Default stats
 * const DEFAULT_PLAYER_STATS: PlayerStats = {
 * 	playtime: 0,
 * 	deaths: 0,
 * 	kills: 0
 * };
 * ```
 */
export const DEFAULT_PLAYER_STATS: PlayerStats = {
	playtime: 0,
	deaths: 0,
	kills: 0,
} as const;

/**
 * Current session information (runtime data, not persisted).
 */
export interface PlayerSession {
	/** When the current session started */
	startTime: Date;
	/** Connection identifier for this session */
	connectionId: number;
	/** The connected client for this session (if any) */
	client: MudClient;
	/** Last message group received in this session */
	lastMessageGroup?: MESSAGE_GROUP;
}

/**
 * Uses Partial<T> as a base and then manually sets fields to required by name.
 */
export type RequireOnly<T, K extends keyof T> = Partial<T> &
	Required<Pick<T, K>>;

/**
 * These are the only fields required to be provided for CharacterOptions.
 * Other fields will be automatically generated.
 */
export type RequiredPlayerCredentials = RequireOnly<
	PlayerCredentials,
	"username"
>;

/**
 * Options for creating a new Character instance.
 */
export interface CharacterOptions {
	/** Player's authentication and account information. Only `username` is required; other fields get sane defaults. */
	credentials: RequiredPlayerCredentials;
	/** Optional initial settings (defaults applied if not provided) */
	settings?: Partial<PlayerSettings>;
	/** Optional initial stats (defaults applied if not provided) */
	stats?: Partial<PlayerStats>;
	/** The mob instance that represents this character in the game world */
	mob: Mob;
}

/**
 * Serialized character data for persistence.
 * Dates are represented as ISO strings; runtime-only fields (like session) are excluded.
 */
export interface SerializedPlayerCredentials {
	/** Player's username/login name */
	username: string;
	/** Hashed password (never store plain text) */
	passwordHash: string;
	/** Email address for account recovery */
	email?: string;
	/** Account creation timestamp (ISO string) */
	createdAt: string;
	/** Last login timestamp (ISO string) */
	lastLogin: string;
	/** Character is active / playable */
	isActive: boolean;
	/** Character is banned */
	isBanned: boolean;
	/** Character is an admin */
	isAdmin: boolean;
}

/**
 * Serialized player settings with channels as an array instead of Set.
 */
export interface SerializedPlayerSettings {
	/** Whether to receive out-of-character (OOC) messages */
	receiveOOC?: boolean;
	/** Whether to show verbose room descriptions */
	verboseMode?: boolean;
	/** Preferred command prompt format */
	prompt?: string;
	/** Color preferences */
	colorEnabled?: boolean;
	/** Auto-look after movement */
	autoLook?: boolean;
	/** Brief mode for room descriptions */
	briefMode?: boolean;
	/** Channels the player is subscribed to (serialized as array of enum values) */
	channels?: CHANNEL[];
	/** Blocked usernames (serialized as array) */
	blockedUsers?: string[];
}

export interface SerializedCharacter {
	/** Player's account credentials and authentication info (serialized) */
	credentials: SerializedPlayerCredentials;
	/** Player's game settings and preferences (serialized) */
	settings: SerializedPlayerSettings;
	/** Player's gameplay statistics and progression */
	stats: PlayerStats;
	/** Serialized mob data for reconstructing the character's mob representation */
	mob: SerializedMob;
}

/**
 * Character represents a player's persistent data and avatar in the world.
 *
 * Responsibilities
 * - Authentication data and player preferences
 * - Runtime session tracking
 * - Message sending with group-aware prompt behavior
 * - Serialization/deserialization for persistence
 * - Bidirectional relationship with `Mob` (Character.mob ↔ Mob.character)
 *
 * Example
 * ```ts
 * import { Character, MESSAGE_GROUP } from "./character.js";
 * import { Mob } from "./dungeon.js";
 *
 * const c = new Character({
 *   credentials: { username: "playerOne" },
 *   mob: new Mob(),
 * });
 * c.setPassword("secretPassword");
 *
 * // Typically called by the Game when a client connects
 * // c.startSession(1, client);
 *
 * c.sendMessage("Welcome!", MESSAGE_GROUP.SYSTEM);
 * const data = c.serialize();
 * const restored = Character.deserialize(data);
 * ```
 */
export class Character {
	/**
	 * The underlying Mob that represents this character in the game world.
	 * This mob will have its character field set to reference this Character instance,
	 * creating a bidirectional relationship.
	 */
	private _mob!: Mob;

	/**
	 * Gets the mob associated with this character.
	 * @returns The Mob instance representing this character in the game world
	 */
	public get mob(): Mob {
		return this._mob;
	}

	/**
	 * Sets the mob associated with this character and establishes bidirectional reference.
	 * @param mob The new Mob instance to associate with this character
	 */
	public set mob(mob: Mob) {
		if (this.mob === mob) return;
		const omob = this._mob;
		this._mob = mob; // start be silently setting new mob
		// this ensures other setters in the bidirectional link
		// don't get confused and try to reset it during setting
		if (omob && omob.character === this) omob.character = undefined;

		// Set up new bidirectional relationship
		if (mob.character !== this) mob.character = this;
	}

	/** Player's account credentials and authentication info */
	public readonly credentials: PlayerCredentials;

	/** Player's game settings and preferences */
	public settings: PlayerSettings;

	/** Player's gameplay statistics and progression */
	public stats: PlayerStats;

	/** Current session information (runtime data, not persisted) */
	public session?: PlayerSession;

	/** Username of the last person who whispered to this character (for reply command) */
	public lastWhisperFrom?: string;

	/**
	 * Creates a new Character instance.
	 *
	 * @param options Character creation options containing credentials, settings, stats, and mob
	 *
	 * @example
	 * ```ts
	 * import { Character } from "./character.js";
	 * import { Mob } from "./dungeon.js";
	 *
	 * // Minimal setup: only username is required; other fields get sensible defaults
	 * const character = new Character({
	 *   credentials: { username: "hero123" },
	 *   mob: new Mob(),
	 * });
	 *
	 * // Set a password (stored as a salted SHA-256 hash)
	 * character.setPassword("super-secret");
	 *
	 * // Optional: customize settings/stats on creation
	 * const c2 = new Character({
	 *   credentials: { username: "mage" },
	 *   settings: { prompt: "> ", colorEnabled: true },
	 *   stats: { playtime: 5000, deaths: 0, kills: 3 },
	 *   mob: new Mob(),
	 * });
	 *
	 * // When a client connects (handled by the Game), start a session:
	 * // c2.startSession(1, client);
	 * ```
	 */
	constructor(options: CharacterOptions) {
		const now = new Date();
		this.credentials = {
			...{ passwordHash: "" },
			...{ createdAt: now, lastLogin: now },
			...DEFAULT_PLAYER_CREDENTIALS, // defaults
			...options.credentials,
		};

		// Apply default settings
		this.settings = {
			...DEFAULT_PLAYER_SETTINGS,
			...options.settings,
		};

		// Initialize channels with defaults if not provided
		if (!this.settings.channels) {
			this.settings.channels = new Set<CHANNEL>(DEFAULT_CHANNELS);
		}

		// Initialize blockedUsers if not provided
		if (!this.settings.blockedUsers) {
			this.settings.blockedUsers = new Set<string>();
		}

		// Apply default stats
		this.stats = {
			...DEFAULT_PLAYER_STATS,
			...options.stats,
		};

		// Set up the provided mob
		this.mob = options.mob;
	}

	toString(): string {
		return this.mob.display;
	}

	/**
	 * Updates the character's settings with new values.
	 * Only updates provided settings, leaves others unchanged.
	 *
	 * @param newSettings Partial settings object with values to update
	 *
	 * @example
	 * ```typescript
	 * character.updateSettings({
	 *   colorEnabled: false,
	 *   prompt: "$ ",
	 *   briefMode: true
	 * });
	 * ```
	 */
	public updateSettings(newSettings: Partial<PlayerSettings>): void {
		this.settings = { ...this.settings, ...newSettings };
	}

	/**
	 * Starts a new session for this character. Called by the game when a player logs in.
	 *
	 * @param connectionId Numeric connection identifier for this session
	 * @param client The connected MudClient for this session
	 *
	 * @example
	 * ```ts
	 * character.startSession(1, client);
	 * ```
	 */
	public startSession(connectionId: number, client: MudClient): void {
		this.session = {
			startTime: new Date(),
			connectionId,
			client,
		};
		this.updateLastLogin(this.session.startTime);

		// Grant admin privileges to localhost connections
		if (client.isLocalhost()) {
			this.credentials.isAdmin = true;
		}
	}

	/**
	 * Ends the current session for this character.
	 * Should be called by the game engine when the player logs out.
	 *
	 * @example
	 * ```typescript
	 * character.endSession();
	 * console.log(`Session ended for ${character.credentials.username}`);
	 * ```
	 */
	public endSession(): void {
		if (!this.session) return;
		const sessionDuration = this.getSessionDuration();
		this.addPlaytime(sessionDuration);
		this.session = undefined;
	}

	/**
	 * Gets the duration of the current session in milliseconds.
	 * Returns 0 if no active session.
	 *
	 * @returns Current session duration in milliseconds
	 *
	 * @example
	 * ```typescript
	 * if (character.session.isActive) {
	 *   const duration = character.getSessionDuration();
	 *   console.log(`Online for ${Math.floor(duration / 1000)} seconds`);
	 * }
	 * ```
	 */
	public getSessionDuration(): number {
		if (!this.session) return 0;
		return Date.now() - this.session.startTime.getTime();
	}

	/**
	 * Updates the last login timestamp.
	 * Should be called by the session manager when the character logs in.
	 *
	 * @param loginTime The login timestamp (defaults to current time)
	 *
	 * @example
	 * ```typescript
	 * character.updateLastLogin(); // Uses current time
	 * character.updateLastLogin(new Date('2023-01-01')); // Specific time
	 * ```
	 */
	public updateLastLogin(loginTime: Date = new Date()): void {
		this.credentials.lastLogin = loginTime;
	}

	/**
	 * Adds playtime to the character's total.
	 * Should be called by the session manager when a session ends.
	 *
	 * @param sessionDurationMs Session duration in milliseconds
	 *
	 * @example
	 * ```typescript
	 * const sessionStart = Date.now();
	 * // ... time passes ...
	 * const sessionDuration = Date.now() - sessionStart;
	 * character.addPlaytime(sessionDuration);
	 * ```
	 */
	public addPlaytime(sessionDurationMs: number): void {
		this.stats.playtime += sessionDurationMs;
	}

	/**
	 * Records a character death.
	 * Increments death counter for statistics tracking.
	 *
	 * @example
	 * ```typescript
	 * // Called when character dies
	 * character.recordDeath();
	 * console.log(`${character.credentials.username} has died ${character.stats.deaths} times`);
	 * ```
	 */
	public recordDeath(): void {
		this.stats.deaths++;
	}

	/**
	 * Records defeating a mob.
	 * Increments kill counter for statistics tracking.
	 *
	 * @example
	 * ```typescript
	 * // Called when character defeats an enemy
	 * character.recordKill();
	 * ```
	 */
	public recordKill(): void {
		this.stats.kills++;
	}

	/**
	 * Send raw text to the currently connected client for this character.
	 * If no client is connected, this is a no-op.
	 */
	public send(text: string) {
		this.session?.client.send(text, this.settings.colorEnabled);
	}

	/**
	 * Send a line of text (with newline) to the currently connected client.
	 * If no client is connected, this is a no-op.
	 */
	public sendLine(text: string) {
		this.send(`${text}${LINEBREAK}`);
	}

	/** Core routine for group-aware sending */
	public sendMessage(text: string, group: MESSAGE_GROUP): void {
		const session = this.session;
		const client = session?.client;
		if (!session || !client || !client.isConnected()) return;
		else this.sendLine(text);

		const last = session.lastMessageGroup;
		if (last !== group) {
			this.sendLine("");
			this.send(this.settings.prompt ?? "> ");
		}
		session.lastMessageGroup = group;
	}

	/**
	 * Gets formatted playtime as a human-readable string.
	 *
	 * @returns Formatted playtime string
	 *
	 * @example
	 * ```typescript
	 * console.log(`Total playtime: ${character.getFormattedPlaytime()}`);
	 * // Output: "Total playtime: 2 hours, 34 minutes"
	 * ```
	 */
	public getFormattedPlaytime(): string {
		let totalMs = this.stats.playtime;

		// Add current session time if active
		if (this.session) totalMs += this.getSessionDuration();

		const hours = Math.floor(totalMs / (1000 * 60 * 60));
		const minutes = Math.floor((totalMs % (1000 * 60 * 60)) / (1000 * 60));

		if (hours > 0) {
			return `${hours} hours, ${minutes} minutes`;
		} else {
			return `${minutes} minutes`;
		}
	}

	/**
	 * Checks if the character has administrative privileges.
	 *
	 * @returns true if character is an admin
	 *
	 * @example
	 * ```typescript
	 * if (character.isAdmin()) {
	 *   // Allow access to admin commands
	 * }
	 * ```
	 */
	public isAdmin(): boolean {
		return this.credentials.isAdmin;
	}

	/**
	 * Checks if the character's account is active and not banned.
	 *
	 * @returns true if character can play
	 *
	 * @example
	 * ```typescript
	 * if (!character.canPlay()) {
	 *   console.log("Account is inactive or banned");
	 *   return;
	 * }
	 * ```
	 */
	public canPlay(): boolean {
		return this.credentials.isActive && !this.credentials.isBanned;
	}

	/**
	 * Updates the character's password.
	 * Automatically hashes the new password before storing.
	 *
	 * @param newPassword The new plain text password
	 *
	 * @example
	 * ```typescript
	 * character.setPassword("newSecurePassword123");
	 * ```
	 */
	public setPassword(newPassword: string): void {
		this.credentials.passwordHash = Character.hashPassword(newPassword);
	}

	/**
	 * Subscribes the character to a channel.
	 *
	 * @param channel The channel to join
	 *
	 * @example
	 * ```typescript
	 * character.joinChannel(CHANNEL.OOC);
	 * character.joinChannel(CHANNEL.NEWBIE);
	 * ```
	 */
	public joinChannel(channel: CHANNEL): void {
		if (!this.settings.channels) {
			this.settings.channels = new Set<CHANNEL>();
		}
		this.settings.channels.add(channel);
	}

	/**
	 * Unsubscribes the character from a channel.
	 *
	 * @param channel The channel to leave
	 *
	 * @example
	 * ```typescript
	 * character.leaveChannel(CHANNEL.OOC);
	 * ```
	 */
	public leaveChannel(channel: CHANNEL): void {
		if (!this.settings.channels) return;
		this.settings.channels.delete(channel);
	}

	/**
	 * Checks if the character is subscribed to a channel.
	 *
	 * @param channel The channel to check
	 * @returns true if subscribed to the channel
	 *
	 * @example
	 * ```typescript
	 * if (character.isInChannel(CHANNEL.OOC)) {
	 *   // Character will receive OOC messages
	 * }
	 * ```
	 */
	public isInChannel(channel: CHANNEL): boolean {
		if (!this.settings.channels) return false;
		return this.settings.channels.has(channel);
	}

	/**
	 * Sends a chat message to this character if they are subscribed to the channel.
	 *
	 * @param speaker The character sending the message
	 * @param message The message text
	 * @param channel The channel the message is being sent on
	 *
	 * @example
	 * ```typescript
	 * // Send OOC message to all characters in the OOC channel
	 * for (const character of allCharacters) {
	 *   character.sendChat(speaker, "Hello everyone!", CHANNEL.OOC);
	 * }
	 * ```
	 */
	public sendChat(speaker: Character, message: string, channel: CHANNEL): void {
		if (!this.isInChannel(channel)) return;

		// Check if the speaker is blocked by this character
		if (
			this.settings.blockedUsers?.has(
				speaker.credentials.username.toLowerCase()
			)
		) {
			return;
		}

		// For whisper channel, update lastWhisperFrom for reply functionality
		if (channel === CHANNEL.WHISPER && speaker !== this) {
			this.lastWhisperFrom = speaker.credentials.username;
		}

		const formatted = formatChannelMessage(
			channel,
			speaker.credentials.username,
			message
		);
		this.sendMessage(formatted, MESSAGE_GROUP.CHANNELS);
	}

	/**
	 * Checks if this character is blocking the specified username.
	 *
	 * @param username The username to check
	 * @returns true if the username is blocked
	 */
	public isBlocking(username: string): boolean {
		return this.settings.blockedUsers?.has(username.toLowerCase()) ?? false;
	}

	/**
	 * Blocks a user by username. Automatically converts to lowercase.
	 * Blocked users cannot send whispers or other direct messages to this character.
	 *
	 * @param username The username to block
	 *
	 * @example
	 * ```typescript
	 * character.block("SpammerUser");
	 * // Now SpammerUser (case-insensitive) cannot whisper this character
	 * ```
	 */
	public block(username: string): void {
		if (!this.settings.blockedUsers) {
			this.settings.blockedUsers = new Set<string>();
		}
		this.settings.blockedUsers.add(username.toLowerCase());
	}

	/**
	 * Unblocks a user by username. Automatically converts to lowercase.
	 *
	 * @param username The username to unblock
	 *
	 * @example
	 * ```typescript
	 * character.unblock("FormerlyBlockedUser");
	 * // Now FormerlyBlockedUser can whisper this character again
	 * ```
	 */
	public unblock(username: string): void {
		if (!this.settings.blockedUsers) return;
		this.settings.blockedUsers.delete(username.toLowerCase());
	}

	/**
	 * Verifies if the provided password matches the stored password.
	 * Hashes the input password and compares it to the stored hash.
	 *
	 * @param password The plain text password to verify
	 * @returns true if the password matches
	 *
	 * @example
	 * ```typescript
	 * if (character.verifyPassword("userInputPassword")) {
	 *   console.log("Password correct!");
	 * } else {
	 *   console.log("Invalid password");
	 * }
	 * ```
	 */
	public verifyPassword(password: string): boolean {
		return this.credentials.passwordHash === Character.hashPassword(password);
	}

	/**
	 * Hashes a password using SHA256 with the configured salt.
	 *
	 * @param password The plain text password to hash
	 * @returns The SHA256 hash of the salted password
	 *
	 * @example
	 * ```typescript
	 * const hashedPassword = Character.hashPassword("myPassword123");
	 * ```
	 */
	public static hashPassword(password: string): string {
		const saltedPassword = password + CONFIG.security.password_salt;
		return createHash("sha256").update(saltedPassword).digest("hex");
	}

	/**
	 * Serializes the character data for persistence.
	 * Excludes the mob instance and runtime data.
	 *
	 * @returns Serializable character data
	 *
	 * @example
	 * ```typescript
	 * const saveData = character.serialize();
	 * await fs.writeFile(`characters/${character.credentials.username}.json`,
	 *   JSON.stringify(saveData, null, 2));
	 * ```
	 */
	public serialize(): SerializedCharacter {
		const c = this.credentials;
		const serializedCreds: SerializedPlayerCredentials = {
			username: c.username,
			passwordHash: c.passwordHash,
			email: c.email,
			createdAt: c.createdAt.toISOString(),
			lastLogin: c.lastLogin.toISOString(),
			isActive: c.isActive,
			isBanned: c.isBanned,
			isAdmin: c.isAdmin,
		};

		// Convert channels and blockedUsers Sets to arrays for serialization
		const serializedSettings: SerializedPlayerSettings = {
			...this.settings,
			channels: this.settings.channels
				? Array.from(this.settings.channels)
				: [],
			blockedUsers: this.settings.blockedUsers
				? Array.from(this.settings.blockedUsers)
				: [],
		};

		return {
			credentials: serializedCreds,
			settings: serializedSettings,
			stats: this.stats,
			mob: this.mob.serialize() as SerializedMob,
		};
	}

	/**
	 * Creates a Character instance from serialized data.
	 *
	 * @param data Serialized character data
	 * @returns New Character instance
	 *
	 * @example
	 * ```typescript
	 * const saveData = JSON.parse(await fs.readFile(`characters/${username}.json`, 'utf8'));
	 * const character = Character.deserialize(saveData);
	 * ```
	 */
	public static deserialize(data: SerializedCharacter): Character {
		// Deserialize the mob using the dungeon system's deserializer
		const mob = Mob.deserialize(data.mob);

		const creds: PlayerCredentials = {
			username: data.credentials.username,
			passwordHash: data.credentials.passwordHash,
			email: data.credentials.email,
			createdAt: new Date(data.credentials.createdAt),
			lastLogin: new Date(data.credentials.lastLogin),
			isActive: data.credentials.isActive,
			isBanned: data.credentials.isBanned,
			isAdmin: data.credentials.isAdmin,
		};

		// Convert channels and blockedUsers arrays back to Sets
		const settings: PlayerSettings = {
			...data.settings,
			channels:
				data.settings.channels !== undefined
					? new Set(data.settings.channels)
					: new Set<CHANNEL>(),
			blockedUsers:
				data.settings.blockedUsers !== undefined
					? new Set(data.settings.blockedUsers)
					: new Set<string>(),
		};

		const character = new Character({
			credentials: creds,
			settings: settings,
			stats: data.stats,
			mob: mob,
		});

		// The bidirectional reference is already set up in the constructor
		return character;
	}
}
