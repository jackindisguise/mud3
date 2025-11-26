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
 * import { Mob } from "./mob.js";
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
import { CONFIG } from "./registry/config.js";
import type { MudClient } from "./io.js";
import { CHANNEL, formatChannelMessage } from "./channel.js";
import { LINEBREAK } from "./telnet.js";
import { formatPlaytime } from "./time.js";
import { color, COLOR, stickyColor } from "./color.js";
import type { ActionState } from "./command.js";
import { Ability } from "./ability.js";

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
	ACTION = "ACTION",
	PROMPT = "PROMPT",
}

/**
 * Dictionary mapping MESSAGE_GROUP enum values to their lowercase string names.
 * Used for command parsing and display.
 */
export const MESSAGE_GROUP_NAMES: Record<MESSAGE_GROUP, string> = {
	[MESSAGE_GROUP.INFO]: "info",
	[MESSAGE_GROUP.COMBAT]: "combat",
	[MESSAGE_GROUP.COMMAND_RESPONSE]: "command-response",
	[MESSAGE_GROUP.SYSTEM]: "system",
	[MESSAGE_GROUP.CHANNELS]: "channels",
	[MESSAGE_GROUP.ACTION]: "action",
	[MESSAGE_GROUP.PROMPT]: "prompt",
};

/**
 * Player-specific settings and configuration.
 */
export type EchoMode = "client" | "server" | "off";

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
	/** Default terminal color for all messages sent to this character */
	defaultColor?: COLOR;
	/** Input echo preference */
	echoMode?: EchoMode;
	/** Whether busy mode is enabled */
	busyModeEnabled?: boolean;
	/** Whether combat busy mode is enabled */
	combatBusyModeEnabled?: boolean;
	/** Message groups to forward to answering machine in busy mode */
	busyForwardedGroups?: Set<MESSAGE_GROUP>;
	/** Message groups to forward to answering machine in combat busy mode */
	combatBusyForwardedGroups?: Set<MESSAGE_GROUP>;
}

/**
 * Default channels that new characters are subscribed to.
 * Players start subscribed to OOC, GOSSIP, GOCIAL, SAY, and WHISPER channels by default.
 * They must opt-in to NEWBIE and TRADE channels.
 */
export const DEFAULT_CHANNELS: readonly CHANNEL[] = [
	CHANNEL.OOC,
	CHANNEL.GOSSIP,
	CHANNEL.GOCIAL,
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
	prompt: "{R%hh/%HH{rhp {C%mm/%MM{cmana {Y%ee{yexh {C%xp{cxp {B%XX{btnl{x > ",
	colorEnabled: true,
	autoLook: true,
	briefMode: false,
	echoMode: "client",
	busyModeEnabled: false,
	combatBusyModeEnabled: true,
	busyForwardedGroups: new Set([MESSAGE_GROUP.CHANNELS]),
	combatBusyForwardedGroups: new Set([MESSAGE_GROUP.CHANNELS]),
} as const;

/**
 * Authentication and account information (runtime form).
 *
 * Note: `createdAt` and `lastLogin` are Date objects in memory. When persisted,
 * these become ISO strings via `SerializedPlayerCredentials`.
 */
export interface PlayerCredentials {
	/** Unique character ID (assigned on creation) */
	characterId: number;
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
export interface QueuedMessage {
	text: string;
	group: MESSAGE_GROUP;
	timestamp: Date;
}

export interface PlayerSession {
	/** When the current session started */
	startTime: Date;
	/** Connection identifier for this session */
	connectionId: number;
	/** The connected client for this session (if any) */
	client: MudClient;
	/** Last message group received in this session */
	lastMessageGroup?: MESSAGE_GROUP;
	/** Queued messages waiting to be read (busy mode) */
	queuedMessages?: QueuedMessage[];
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
	mob?: Mob;
}

/**
 * Serialized character data for persistence.
 * Dates are represented as ISO strings; runtime-only fields (like session) are excluded.
 */
export interface SerializedPlayerCredentials {
	/** Unique character ID (assigned on creation) */
	characterId: number;
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
	/** Default terminal color for all messages sent to this character (serialized as number) */
	defaultColor?: number;
	/** Whether busy mode is enabled */
	busyModeEnabled?: boolean;
	/** Whether combat busy mode is enabled */
	combatBusyModeEnabled?: boolean;
	/** Message groups to forward to answering machine in busy mode (serialized as array) */
	busyForwardedGroups?: MESSAGE_GROUP[];
	/** Message groups to forward to answering machine in combat busy mode (serialized as array) */
	combatBusyForwardedGroups?: MESSAGE_GROUP[];
}

export interface SerializedCharacter {
	/** Player's account credentials and authentication info (serialized) */
	credentials: SerializedPlayerCredentials;
	/** Player's game settings and preferences (serialized) */
	settings: SerializedPlayerSettings;
	/** Player's gameplay statistics and progression */
	stats: PlayerStats;
	/** Serialized mob data for reconstructing the character's mob representation */
	mob?: Omit<SerializedMob, "type">;
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
 * import { Mob } from "./mob.js";
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
	private _mob?: Mob;

	/**
	 * Gets the mob associated with this character.
	 * @returns The Mob instance representing this character in the game world
	 */
	public get mob(): Mob | undefined {
		return this._mob;
	}

	/**
	 * Sets the mob associated with this character and establishes bidirectional reference.
	 * @param mob The new Mob instance to associate with this character
	 */
	public set mob(mob: Mob | undefined) {
		if (this.mob === mob) return;
		const omob = this._mob;
		this._mob = mob;
		if (omob && omob.character === this) omob.character = undefined;
		if (mob && mob.character !== this) mob.character = this;
	}

	/** Player's account credentials and authentication info */
	public readonly credentials: PlayerCredentials;

	/** Player's game settings and preferences */
	public settings: PlayerSettings;

	/** Player's gameplay statistics and progression */
	public stats: PlayerStats;

	/** Current session information (runtime data, not persisted) */
	public session?: PlayerSession;

	/** Runtime command action state (cooldowns/queues) */
	public actionState?: ActionState;

	/** Character ID of the last person who whispered to this character (for reply command) */
	public lastWhisperFromId?: number;

	/**
	 * Creates a new Character instance.
	 *
	 * @param options Character creation options containing credentials, settings, stats, and mob
	 *
	 * @example
	 * ```ts
	 * import { Character } from "./character.js";
	 * import { Mob } from "./mob.js";
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
		// characterId is required - if not provided, it should be assigned during creation
		if (!options.credentials.characterId) {
			throw new Error(
				"characterId is required. Characters must be assigned an ID during creation."
			);
		}
		this.credentials = {
			characterId: options.credentials.characterId, // Explicitly set required field
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
		if (options.mob) this.mob = options.mob;
	}

	toString(): string {
		return this.mob?.display ?? "Unknown";
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
	 * If defaultColor is set in settings, applies stickyColor to the text.
	 */
	public send(text: string) {
		if (!this.session?.client) return;

		const session = this.session;
		const client = session.client;

		if (session.lastMessageGroup === MESSAGE_GROUP.PROMPT) {
			client.sendLine(" ", false);
			session.lastMessageGroup = undefined;
		}

		let finalText = text;
		if (this.settings.defaultColor !== undefined) {
			finalText = stickyColor(text, this.settings.defaultColor);
		}

		client.send(finalText, this.settings.colorEnabled ?? true);
	}

	/**
	 * Send a line of text (with newline) to the currently connected client.
	 * If no client is connected, this is a no-op.
	 */
	public sendLine(text: string) {
		if (!this.session?.client) return;

		const session = this.session;
		const client = session.client;

		if (session.lastMessageGroup === MESSAGE_GROUP.PROMPT) {
			client.sendLine(" ", false);
			session.lastMessageGroup = undefined;
		}

		let finalText = text;
		if (this.settings.defaultColor !== undefined) {
			finalText = stickyColor(text, this.settings.defaultColor);
		}

		client.sendLine(finalText, this.settings.colorEnabled ?? true);
	}

	/**
	 * Ask for a single line of input and route the next received line
	 * to the provided callback. This supersedes the standard "input"
	 * event for one line only.
	 *
	 * @param question The question to ask
	 * @param callback The callback to receive the input
	 */
	public ask(question: string, callback: (line: string) => void): void {
		const client = this.session?.client;
		if (!client) return;
		client.ask(question, callback, this.settings.colorEnabled ?? true);
	}

	/**
	 * Ask a yes/no question and route the response to the provided callback.
	 * Supports autocomplete for "yes" and "no" responses.
	 *
	 * @param question The yes/no question to ask
	 * @param callback The callback to receive the boolean response (or undefined if default used)
	 * @param _default Optional default value if user just presses Enter
	 */
	public yesno(
		question: string,
		callback: (yesorno: boolean | undefined) => void,
		_default?: boolean | undefined
	): void {
		const client = this.session?.client;
		if (!client) return;
		client.yesno(question, callback, _default);
	}

	/**
	 * Formats a prompt string by replacing special placeholders with current values.
	 *
	 * Supported placeholders:
	 * - %hh - current health
	 * - %mm - current mana
	 * - %ee - exhaustion level
	 * - %HH - max health
	 * - %MM - max mana
	 * - %xp - current experience points
	 * - %XX - experience needed to next level
	 *
	 * @param prompt The prompt string with placeholders
	 * @returns The formatted prompt string with placeholders replaced
	 */
	private formatPrompt(prompt: string): string {
		if (!this.mob) return prompt;

		let formatted = prompt;

		// Replace placeholders with actual values
		formatted = formatted.replace(/%hh/g, this.mob.health.toString());
		formatted = formatted.replace(/%mm/g, this.mob.mana.toString());
		formatted = formatted.replace(/%ee/g, this.mob.exhaustion.toString());
		formatted = formatted.replace(/%HH/g, this.mob.maxHealth.toString());
		formatted = formatted.replace(/%MM/g, this.mob.maxMana.toString());
		formatted = formatted.replace(/%xp/g, this.mob.experience.toString());
		formatted = formatted.replace(
			/%XX/g,
			this.mob.experienceToLevel.toString()
		);

		return formatted;
	}

	/** Core routine for group-aware sending */
	public sendMessage(text: string, group: MESSAGE_GROUP): void {
		const session = this.session;
		const client = session?.client;
		if (!session || !client || !client.isConnected()) return;

		// Check if busy mode is active
		const isBusy = this.isBusyModeActive();
		const forwardedGroups = this.getActiveForwardedGroups();

		// If busy mode is active and this message group should be forwarded, queue it
		if (isBusy && forwardedGroups.has(group)) {
			if (!session.queuedMessages) {
				session.queuedMessages = [];
			}
			session.queuedMessages.push({ text, group, timestamp: new Date() });
			return;
		}

		// Otherwise, send immediately
		const last = session.lastMessageGroup;
		if (last && last !== group && last !== MESSAGE_GROUP.PROMPT) {
			this.sendLine(" ");
		}

		this.sendLine(text);
		session.lastMessageGroup = group;
	}

	public showPrompt(): void {
		const session = this.session;
		const client = session?.client;
		if (!session || !client || !client.isConnected()) return;

		const promptText = this.settings.prompt ?? "> ";
		this.sendLine(" ");
		const queuedLine = this.formatQueuedActionLine();
		if (queuedLine) {
			this.sendLine(queuedLine);
		}
		const callWaitingLine = this.formatCallWaitingLine();
		if (callWaitingLine) {
			this.sendLine(callWaitingLine);
		}
		this.send(this.formatPrompt(promptText));
		session.lastMessageGroup = MESSAGE_GROUP.PROMPT;
	}

	private formatQueuedActionLine(): string | undefined {
		const state = this.actionState;
		if (!state || state.queue.length === 0) {
			return undefined;
		}

		const nextEntry = state.queue[0];
		const pattern = nextEntry.input;
		const remainingMs =
			state.cooldownExpiresAt !== undefined
				? Math.max(0, state.cooldownExpiresAt - Date.now())
				: 0;
		const remainingSeconds = remainingMs === 0 ? 0 : remainingMs / 1000;

		const time = remainingSeconds > 0 ? `~${remainingSeconds}s` : "";
		return stickyColor(
			`[QUEUE] '${color(pattern, COLOR.WHITE)}' in ${color(
				time,
				COLOR.CRIMSON
			)}`,
			COLOR.OLIVE
		);
	}

	private formatCallWaitingLine(): string | undefined {
		const session = this.session;
		if (!session?.queuedMessages || session.queuedMessages.length === 0) {
			return undefined;
		}

		return stickyColor(
			`[CALL WAITING - type ${color("busy read", COLOR.WHITE)} to read it]`,
			COLOR.OLIVE
		);
	}

	/**
	 * Checks if busy mode is currently active.
	 * Regular busy mode is active if enabled.
	 * Combat busy mode is active if enabled and the mob is in combat.
	 */
	private isBusyModeActive(): boolean {
		if (this.settings.busyModeEnabled) {
			return true;
		}

		if (
			this.settings.combatBusyModeEnabled &&
			this.mob &&
			this.mob.isInCombat()
		) {
			return true;
		}

		return false;
	}

	/**
	 * Gets the set of message groups that should be forwarded in the currently active busy mode.
	 */
	private getActiveForwardedGroups(): Set<MESSAGE_GROUP> {
		// If combat busy mode is active, use combat busy forwarded groups
		if (
			this.settings.combatBusyModeEnabled &&
			this.mob &&
			this.mob.isInCombat()
		) {
			return this.settings.combatBusyForwardedGroups ?? new Set();
		}

		// Otherwise use regular busy forwarded groups
		return this.settings.busyForwardedGroups ?? new Set();
	}

	/**
	 * Reads and sends all queued messages, then clears the queue.
	 */
	public readQueuedMessages(): QueuedMessage[] {
		const session = this.session;
		if (!session?.queuedMessages || session.queuedMessages.length === 0) {
			return [];
		}

		const messages = [...session.queuedMessages];
		session.queuedMessages = [];

		// Send all queued messages
		const now = new Date();
		for (const msg of messages) {
			const last = session.lastMessageGroup;
			if (last && last !== msg.group && last !== MESSAGE_GROUP.PROMPT) {
				this.sendLine(" ");
			}
			const diffMs = now.getTime() - msg.timestamp.getTime();
			const diffSeconds = Math.floor(diffMs / 1000);
			let timestamp: string;
			if (diffSeconds < 60) {
				timestamp = `${diffSeconds}s ago`;
			} else {
				const diffMinutes = Math.floor(diffSeconds / 60);
				timestamp = `${diffMinutes}min ago`;
			}
			const timestampedText = `${color(`[${timestamp}]`, COLOR.SILVER)} ${
				msg.text
			}`;
			this.sendLine(stickyColor(timestampedText, COLOR.PURPLE));
			session.lastMessageGroup = msg.group;
		}

		return messages;
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

		return formatPlaytime(totalMs);
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

		// For whisper channel, update lastWhisperFromId for reply functionality
		if (channel === CHANNEL.WHISPER && speaker !== this) {
			this.lastWhisperFromId = speaker.credentials.characterId;
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
			characterId: c.characterId,
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
			busyForwardedGroups: this.settings.busyForwardedGroups
				? Array.from(this.settings.busyForwardedGroups)
				: [],
			combatBusyForwardedGroups: this.settings.combatBusyForwardedGroups
				? Array.from(this.settings.combatBusyForwardedGroups)
				: [],
		};

		const result: SerializedCharacter = {
			credentials: serializedCreds,
			settings: serializedSettings,
			stats: this.stats,
		};

		if (this.mob) {
			// Serialize mob and remove 'type' field
			const mobData: SerializedMob = {
				...(this.mob.serialize({ compress: true }) as SerializedMob),
			};

			const { type, ...mobDataWithoutType } = mobData;
			result.mob = mobDataWithoutType;
		}

		return result;
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
}
