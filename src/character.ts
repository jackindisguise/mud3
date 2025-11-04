import { Mob, SerializedMob } from "./dungeon.js";
import { createHash } from "crypto";
import { CONFIG } from "./package/config.js";
import type { MudClient } from "./io.js";

/**
 * Message groups categorize outgoing messages to control when a prompt is shown.
 * When a character receives a message whose group differs from the last one
 * they received, we append a blank line and then show the prompt.
 */
export enum MESSAGE_GROUP {
	INFO = "INFO",
	COMBAT = "COMBAT",
	COMMAND_RESPONSE = "COMMAND_RESPONSE",
	SYSTEM = "SYSTEM",
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
}

/**
 * Default player settings applied to new characters.
 */
export const DEFAULT_PLAYER_SETTINGS: PlayerSettings = {
	receiveOOC: true,
	verboseMode: true,
	prompt: "> ",
	colorEnabled: true,
	autoLook: true,
	briefMode: false,
};

/**
 * Authentication and account information.
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
	/** Last login timestamp */
	lastLogin?: Date;
	/** Account status flags */
	isActive: boolean;
	isBanned: boolean;
	isAdmin: boolean;
}

/**
 * Default credential values for new accounts.
 * Note: username, passwordHash, and createdAt must be provided during creation.
 */
export const DEFAULT_PLAYER_CREDENTIALS: Partial<PlayerCredentials> = {
	isActive: true,
	isBanned: false,
	isAdmin: false,
};

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
 */
export const DEFAULT_PLAYER_STATS: PlayerStats = {
	playtime: 0,
	deaths: 0,
	kills: 0,
};

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
 * Options for creating a new Character instance.
 */
export interface CharacterOptions {
	/** Player's authentication and account information */
	credentials: PlayerCredentials;
	/** Optional initial settings (defaults applied if not provided) */
	settings?: Partial<PlayerSettings>;
	/** Optional initial stats (defaults applied if not provided) */
	stats?: Partial<PlayerStats>;
	/** The mob instance that represents this character in the game world */
	mob: Mob;
}

/**
 * Serialized character data for persistence.
 * Contains all character information except runtime data like the mob instance.
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
	lastLogin?: string;
	/** Account status flags */
	isActive: boolean;
	isBanned: boolean;
	isAdmin: boolean;
}

export interface SerializedCharacter {
	/** Player's account credentials and authentication info (serialized) */
	credentials: SerializedPlayerCredentials;
	/** Player's game settings and preferences */
	settings: PlayerSettings;
	/** Player's gameplay statistics and progression */
	stats: PlayerStats;
	/** Serialized mob data for reconstructing the character's mob representation */
	mob: SerializedMob;
}

/**
 * Character represents a player's persistent data and avatar in the MUD world.
 *
 * This class wraps around a Mob to provide player-specific functionality
 * such as authentication, settings, progression tracking, and persistent
 * data management. Characters contain persistent data that survives across
 * sessions, plus runtime session state for the current active session.
 *
 * The Character and its associated Mob have a bidirectional relationship:
 * - Character.mob points to the Mob instance
 * - Mob.character points back to the Character instance
 *
 * This allows code working with either object to access the other when needed.
 *
 * Session management is handled through the session field, which tracks
 * runtime state like session start time and connection ID. This allows
 * the character to calculate current session duration without external
 * session management complexity.
 *
 * @example
 * ```typescript
 * // Create a new character (typically done during character creation)
 * const character = new Character({
 *   credentials: {
 *     username: "playerOne",
 *     passwordHash: await hashPassword("secretPassword"),
 *     email: "player@example.com",
 *     createdAt: new Date(),
 *     isActive: true,
 *     isBanned: false,
 *     isAdmin: false
 *   },
 *   mob: new Mob()
 * });
 *
 * // Configure the character's mob representation
 * character.mob.keywords = "player adventurer";
 * character.mob.display = "Player One";
 * character.mob.description = "A brave adventurer ready for action.";
 *
 * // Session management
 * character.startSession("socket_123"); // Start a new session
 * console.log(`Session duration: ${character.getSessionDuration()}ms`);
 * character.endSession(); // End session and update playtime
 *
 * // Update persistent settings
 * character.updateSettings({
 *   verboseMode: true,
 *   colorEnabled: true,
 *   autoLook: true
 * });
 *
 * // Track gameplay statistics
 * character.recordDeath();
 * character.recordKill();
 * ```
 *
 * Features:
 * - Player authentication and account management
 * - Persistent settings and preferences
 * - Gameplay statistics and progression tracking
 * - Character save/load functionality
 * - Bidirectional Character ↔ Mob relationship
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

	/**
	 * Creates a new Character instance.
	 *
	 * @param options Character creation options containing credentials, settings, stats, and mob
	 *
	 * @example
	 * ```typescript
	 * // Create a mob first
	 * const playerMob = new Mob();
	 *
	 * // Create character with plain text password (will be hashed automatically)
	 * const newCharacter = new Character({
	 *   credentials: {
	 *     username: "hero123",
	 *     passwordHash: "", // Will be set by password option
	 *     email: "hero@example.com",
	 *     createdAt: new Date(),
	 *     isActive: true,
	 *     isBanned: false,
	 *     isAdmin: false
	 *   },
	 *   password: "mySecretPassword", // This will be hashed automatically
	 *   settings: {
	 *     verboseMode: false,
	 *     colorEnabled: true
	 *   },
	 *   stats: {
	 *     playtime: 1000
	 *   },
	 *   mob: playerMob
	 * });
	 * ```
	 */
	constructor(options: CharacterOptions) {
		this.credentials = options.credentials;

		// Apply default settings
		this.settings = {
			...DEFAULT_PLAYER_SETTINGS,
			...options.settings,
		};

		// Apply default stats
		this.stats = {
			...DEFAULT_PLAYER_STATS,
			...options.stats,
		};

		// Set up the provided mob
		this.mob = options.mob;
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
	 * Starts a new session for this character.
	 * Should be called by the game engine when the player logs in.
	 *
	 * @param connectionId Optional connection identifier for this session
	 *
	 * @example
	 * ```typescript
	 * character.startSession("socket_123");
	 * console.log(`Session started for ${character.credentials.username}`);
	 * ```
	 */
	public startSession(connectionId: number, client: MudClient): void {
		this.session = {
			startTime: new Date(),
			connectionId,
			client,
		};
		this.updateLastLogin(this.session.startTime);
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
		this.session?.client.send(text);
	}

	/**
	 * Send a line of text (with newline) to the currently connected client.
	 * If no client is connected, this is a no-op.
	 */
	public sendLine(text: string) {
		this.session?.client.sendLine(text);
	}

	/** Core routine for group-aware sending */
	public sendMessage(text: string, group: MESSAGE_GROUP): void {
		const session = this.session;
		const client = session?.client;
		if (!session || !client || !client.isConnected()) return;
		else client.sendLine(text);

		const last = session.lastMessageGroup;
		if (last !== undefined && last !== group) {
			client.sendLine("");
			client.send(this.settings.prompt ?? "> ");
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
			lastLogin: c.lastLogin ? c.lastLogin.toISOString() : undefined,
			isActive: c.isActive,
			isBanned: c.isBanned,
			isAdmin: c.isAdmin,
		};

		return {
			credentials: serializedCreds,
			settings: this.settings,
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
			lastLogin: data.credentials.lastLogin
				? new Date(data.credentials.lastLogin)
				: undefined,
			isActive: data.credentials.isActive,
			isBanned: data.credentials.isBanned,
			isAdmin: data.credentials.isAdmin,
		};

		const character = new Character({
			credentials: creds,
			settings: data.settings,
			stats: data.stats,
			mob: mob,
		});

		// The bidirectional reference is already set up in the constructor
		return character;
	}
}
