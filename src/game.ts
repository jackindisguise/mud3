/**
 * Orchestrates the MUD server lifecycle, player connections, authentication
 * flow, and player sessions. It bridges the network layer (`MudServer`/`MudClient`)
 * with the domain model (`Character`/`Mob`) and persistence (package loaders).
 *
 * What you get
 * - `Game` class: start/stop server, manage connections and sessions, auto-save
 * - `LOGIN_STATE` enum: explicit states for the authentication/login flow
 * - `LoginSession` interface: per-connection login state container
 * - `startGame()` helper: convenience bootstrapping with graceful shutdown
 *
 * Typical usage
 * ```ts
 * import { startGame } from "./game.js";
 *
 * // Boot the server and begin accepting telnet clients
 * const game = await startGame();
 *
 * // Later, on shutdown
 * await game.stop();
 * ```
 *
 * Notes
 * - Configuration is sourced from `CONFIG` (@see {@link package/config}).
 * - Characters are persisted via {@link package/character} helpers.
 * - Auto-save runs every 5 minutes by default; adjust as needed in code.
 *
 * @module game
 */

import { MudServer, MudClient } from "./io.js";
import { CommandContext, CommandRegistry } from "./command.js";
import { Character, SerializedCharacter, MESSAGE_GROUP } from "./character.js";
import { Mob, Room } from "./dungeon.js";
import { CONFIG } from "./package/config.js";
import {
	saveCharacter as saveCharacterFile,
	loadCharacter as loadCharacterFile,
	characterExists,
	isCharacterActive,
	registerActiveCharacter,
	unregisterActiveCharacter,
	checkCharacterPassword,
	loadCharacterFromSerialized,
} from "./package/character.js";
import logger from "./logger.js";

// Default intervals/timeouts (milliseconds)
export const DEFAULT_SAVE_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Game state and configuration
 */
// Game configuration is provided by the package config (see src/package/config.ts)

/**
 * Player authentication states during the login process.
 *
 * The login flow uses a callback-based approach (nanny) rather than explicit states.
 * These states track the high-level phase of the connection:
 * - CONNECTED: Initial connection, going through login prompts via nanny()
 * - CHARACTER_CREATION: Creating a new character (currently unused, may be used for extended creation)
 * - PLAYING: Authenticated and actively playing in the game world
 */
export enum LOGIN_STATE {
	CONNECTED = "connected",
	CHARACTER_CREATION = "character_creation",
	PLAYING = "playing",
}

export interface LoginSession {
	client: MudClient;
	state: LOGIN_STATE;
	character?: Character;
	lastActivity: Date;
	inactivityTimer?: NodeJS.Timeout;
}

/**
 * Main game orchestrator that manages the MUD server, player connections, and
 * coordinates between the network layer and the world model.
 *
 * Features
 * - Starts/stops the TCP server and listens for clients
 * - Guides clients through a callback-based login flow (username/password) via `nanny()`
 * - Creates/loads `Character`s and starts/stops player sessions
 * - Tracks active characters and login sessions
 * - Periodically auto-saves all active characters
 *
 * Integration points
 * - Wire your command system in `handleGameplayInput()`
 * - Customize authentication flow in `nanny()`
 * - Adjust save cadence via DEFAULT_SAVE_INTERVAL_MS constant
 */
export class Game {
	private server: MudServer;
	private config = CONFIG;

	/** Active login sessions (players going through authentication) */
	private loginSessions = new Set<LoginSession>();

	/** Active player characters (authenticated and playing) */
	private activeCharacters = new Set<Character>();

	private saveTimer?: NodeJS.Timeout;
	private nextConnectionId = 1;

	/** Static singleton instance of the Game */
	public static game?: Game;

	constructor() {
		// Use package config
		this.server = new MudServer(this.config.server.port);
	}

	/**
	 * Update the session's last-activity time and reschedule inactivity timeout.
	 * When the timeout elapses, the client is notified and disconnected.
	 */
	private updateActivity(session: LoginSession): void {
		session.lastActivity = new Date();

		// Clear existing inactivity timer if present
		if (session.inactivityTimer) {
			clearTimeout(session.inactivityTimer);
			session.inactivityTimer = undefined;
		}

		const timeoutSeconds = this.config.server.inactivity_timeout ?? 1800; // default 30min
		const timeoutMs = Math.max(1, timeoutSeconds) * 1000;

		session.inactivityTimer = setTimeout(() => {
			const name = session.character
				? session.character.credentials.username
				: session.client.getAddress();
			logger.info(`Disconnecting ${name} due to inactivity`);
			try {
				session.client.sendLine(
					"You have been disconnected due to inactivity."
				);
			} catch {}
			// Closing the client triggers server 'disconnection' which cleans up the session
			session.client.close();
		}, timeoutMs);
	}

	/**
	 * Start the game server and begin accepting connections.
	 *
	 * Sets up server events, starts listening, and schedules periodic auto-save.
	 *
	 * @example
	 * ```ts
	 * const game = new Game();
	 * await game.start();
	 * // ... later ...
	 * await game.stop();
	 * ```
	 */
	async start() {
		// Set up server event handlers
		this.server.on("listening", () => {
			//logger.info(`MUD server listening on port ${this.config.server.port}`);
		});

		this.server.on("connection", (client: MudClient) => {
			this.handleNewConnection(client);
		});

		this.server.on("disconnection", (client: MudClient) => {
			this.handleDisconnection(client);
		});

		// Start the server
		await this.server.start();

		// Set up auto-save timer
		this.saveTimer = setInterval(() => {
			this.saveAllCharacters();
		}, DEFAULT_SAVE_INTERVAL_MS);
	}

	/**
	 * Stop the game server and clean up resources.
	 *
	 * Clears auto-save, persists all characters, ends sessions, and closes the server.
	 */
	async stop() {
		// Clear auto-save timer
		if (this.saveTimer) {
			clearInterval(this.saveTimer);
			this.saveTimer = undefined;
			logger.debug("Auto-save timer cleared");
		}

		// End all sessions and remove them from the set BEFORE closing the server
		// This prevents handleDisconnection from trying to process them again
		const sessions = Array.from(this.loginSessions);
		logger.debug(`Found ${sessions.length} session/s to end`);
		this.loginSessions.clear(); // Clear immediately to prevent double-processing

		for (const session of sessions) {
			logger.debug(
				`Ending session for ${
					session.character?.credentials.username || "unauthenticated user"
				}`
			);
			await this.endPlayerSession(session);
			logger.debug(
				`Session ended for ${
					session.character?.credentials.username || "unauthenticated user"
				}`
			);
		}

		logger.debug("All sessions ended, stopping server");
		// Stop the server (this will trigger disconnection events, but sessions are already cleared)
		await this.server.stop();
		logger.debug("Server stopped successfully");
	}

	/**
	 * Handle a new client connection: create a login session and begin the flow.
	 */
	private handleNewConnection(client: MudClient): void {
		const clientAddress = client.getAddress();

		logger.info(`New connection: ${clientAddress}`);

		// Create login session
		const session: LoginSession = {
			client,
			state: LOGIN_STATE.CONNECTED,
			lastActivity: new Date(),
		};

		this.loginSessions.add(session);

		// Initialize inactivity tracking for this session
		this.updateActivity(session);

		// Start the nanny-driven login process using ask() prompts
		this.nanny(session);
	}

	/**
	 * Handle client disconnection: clean session and end active gameplay session (if any).
	 */
	private async handleDisconnection(client: MudClient) {
		logger.info(`Client disconnected: ${client}`);

		// Clean up login session
		const session = this.findSessionByClient(client);
		if (!session) return;
		// Clear inactivity timer if set
		if (session.inactivityTimer) {
			clearTimeout(session.inactivityTimer);
			session.inactivityTimer = undefined;
		}

		// remove from session tracking
		this.loginSessions.delete(session);

		// end player session if they were playing
		await this.endPlayerSession(session);
	}

	/**
	 * Handle input from a client.
	 * Routes input to the login flow until `PLAYING`, then to gameplay handler.
	 */
	private handleClientInput(session: LoginSession, input: string): void {
		this.updateActivity(session);
		if (session.state === LOGIN_STATE.PLAYING) {
			// Handle gameplay input
			this.handleGameplayInput(session, input);
		}
	}

	/**
	 * New login/creation flow using callbacks rather than a rigid state machine.
	 * This asks for username, then password, authenticates, and starts play.
	 * Extend this with additional prompts for character creation as needed.
	 */
	private nanny(session: LoginSession): void {
		const client = session.client;
		const self = this;
		let username = "";
		let password = "";
		client.sendLine("Welcome to the MUD!");

		const askName = () => {
			client.ask("What is your name?", async (input) => {
				if (!input) return askName();
				// can't login to character that's online
				if (isCharacterActive(input))
					return client.sendLine("That character is already playing.");

				username = input; // save username
				// new name, start making a character
				if (!(await characterExists(input))) {
					return confirmCharacterCreation();
				} else {
					return confirmExistingCharacterPassword();
				}

				askName();
			});
		};

		const confirmExistingCharacterPassword = () => {
			client.ask("Password:", async (_password) => {
				// Check password and get serialized character data
				const serializedCharacter = await checkCharacterPassword(
					username,
					_password
				);
				if (!serializedCharacter) {
					client.sendLine("Invalid password. Disconnecting.");
					client.close();
					return;
				}

				// Load the character from serialized data
				const loadedCharacter =
					loadCharacterFromSerialized(serializedCharacter);

				// Password is correct, show MOTD and start session
				MOTD(loadedCharacter);
			});
		};

		const confirmCharacterCreation = () => {
			client.yesno(
				`Do you wish to create a character named '${username}'?`,
				(yesorno) => {
					if (yesorno === true) return getNewPassword();
					else if (yesorno === false) return askName();
					else return confirmCharacterCreation();
				}
			);
		};

		const getNewPassword = () => {
			client.ask("Please enter a password:", (_password) => {
				if (!_password) return getNewPassword();
				if (_password.length < 5) {
					client.sendLine("It needs to be longer than 5 characters.");
					return getNewPassword();
				}
				password = _password;
				confirmNewPassword();
			});
		};

		const confirmNewPassword = () => {
			client.ask("Please re-type your password:", (_password) => {
				if (_password != password) {
					client.sendLine("Those passwords don't match! Try again.");
					return getNewPassword();
				}
				MOTD();
			});
		};

		const MOTD = (existingCharacter?: Character) => {
			client.sendLine("This is the MOTD.");
			client.ask("Press any key to continue...", () => {
				let character: Character;

				if (existingCharacter) {
					// Use the loaded existing character
					character = existingCharacter;
				} else {
					// Create a new character
					const mob = new Mob({
						display: username,
						keywords: username,
					});
					character = new Character({
						credentials: { username },
						mob,
					});
					character.setPassword(password);
					saveCharacterFile(character);
				}

				self.startPlayerSession(session, character);
			});
		};

		logger.debug(`calling askName() to start login process for ${client}`);
		askName();
	}

	/**
	 * Handle gameplay input from an authenticated player.
	 *
	 * Hook your command registry here to parse and execute player commands.
	 */
	private handleGameplayInput(session: LoginSession, input: string): void {
		const character = session.character;
		if (!character) {
			logger.error(`No active character found for session`);
			return;
		}

		logger.debug(`${character.credentials.username} input: ${input}`);

		// generate the context
		const context: CommandContext = {
			actor: character.mob,
			room:
				character.mob.location instanceof Room
					? character.mob.location
					: undefined,
		};
		const executed = CommandRegistry.default.execute(input, context);
		if (!executed) {
			session.client.sendLine("Do what?");
		}
	}

	/**
	 * Start a gameplay session for an authenticated character.
	 * Associates the connection, transitions to PLAYING, and welcomes the player.
	 */
	private startPlayerSession(session: LoginSession, character: Character) {
		const connectionId = this.nextConnectionId++;

		// Start character session (attach client for convenience send helpers)
		character.startSession(connectionId, session.client);

		// Move to playing state
		session.state = LOGIN_STATE.PLAYING;
		session.character = character;

		// Track active character
		this.activeCharacters.add(character);

		// Register with character package registry (local lock)
		registerActiveCharacter(character);

		// Welcome the player
		session.client.sendLine(`Welcome back, ${character.credentials.username}!`);
		session.client.sendLine("You are now playing.");

		logger.info(`${character.credentials.username} has entered the game`);

		// Wire gameplay input handler now that the player is in the world
		session.client.on("input", (line: string) => {
			this.handleClientInput(session, line);
		});
	}

	/**
	 * End a player's session.
	 * Persists the character and removes tracking.
	 */
	private async endPlayerSession(session: LoginSession) {
		// Find the session for this character and clear its inactivity timer
		if (session.inactivityTimer) {
			clearTimeout(session.inactivityTimer);
			session.inactivityTimer = undefined;
		}

		// End character session
		if (!session.character) return;
		session.character.endSession();

		// Save character
		await saveCharacterFile(session.character);

		// Clean up tracking
		this.activeCharacters.delete(session.character);

		// Remove from character package registry (local lock)
		unregisterActiveCharacter(session.character);

		logger.info(`${session.character} has left the game`);
	}

	/**
	 * Save all active characters.
	 */
	private async saveAllCharacters() {
		if (this.activeCharacters.size == 0) return;
		logger.info(`Saving ${this.activeCharacters.size} active characters...`);

		const savePromises = Array.from(this.activeCharacters.values()).map(
			(character) => saveCharacterFile(character)
		);

		await Promise.all(savePromises);
	}

	/**
	 * Find a login session by client.
	 */
	private findSessionByClient(client: MudClient): LoginSession | undefined {
		for (const s of this.loginSessions) if (s.client === client) return s;
	}

	/**
	 * Get statistics about the current game state.
	 *
	 * @returns An object containing counts of active connections, players online, and login sessions
	 */
	public getGameStats() {
		return {
			activeConnections: this.loginSessions.size,
			playersOnline: this.activeCharacters.size,
		};
	}

	/**
	 * Broadcast a message to all active playing characters.
	 *
	 * @param text The message to send
	 * @param group The message group to use (defaults to INFO)
	 *
	 * @example
	 * ```ts
	 * game.broadcast("Server restart in 5 minutes!", MESSAGE_GROUP.SYSTEM);
	 * ```
	 */
	public broadcast(text: string, group?: MESSAGE_GROUP): void {
		for (const character of this.activeCharacters) {
			if (group !== undefined) {
				character.sendMessage(text, group);
			} else {
				character.sendLine(text);
			}
		}
	}

	/**
	 * Announce a message to all connected clients, regardless of login state.
	 *
	 * @param text The message to send
	 *
	 * @example
	 * ```ts
	 * game.announce("Server is shutting down NOW!");
	 * ```
	 */
	public announce(text: string): void {
		for (const session of this.loginSessions) {
			try {
				session.client.sendLine(text);
			} catch (error) {
				logger.error(`Failed to send broadcast to client: ${error}`);
			}
		}
	}

	/**
	 * Execute a function for each login session.
	 *
	 * @param callback The function to call with each login session
	 *
	 * @example
	 * ```ts
	 * game.forEachSession((session) => {
	 *   console.log(`Session state: ${session.state}`);
	 * });
	 * ```
	 */
	public forEachSession(callback: (session: LoginSession) => void): void {
		for (const session of this.loginSessions) callback(session);
	}

	/**
	 * Execute a function for each active playing character.
	 *
	 * @param callback The function to call with each character
	 *
	 * @example
	 * ```ts
	 * game.forEachCharacter((character) => {
	 *   console.log(`Character: ${character.credentials.username}`);
	 * });
	 * ```
	 */
	public forEachCharacter(callback: (character: Character) => void): void {
		for (const character of this.activeCharacters) callback(character);
	}
}

// Example usage
/**
 * Start the game with graceful shutdown handling.
 *
 * @example
 * ```ts
 * const game = await startGame();
 * // ... application runs ...
 * await game.stop();
 * ```
 */
export async function startGame(): Promise<Game> {
	if (!Game.game) {
		Game.game = new Game();
	}
	const game = Game.game;

	// Handle graceful shutdown
	process.on("SIGINT", async () => {
		logger.info("Shutting down gracefully...");
		await game.stop();
		process.exit(0);
	});

	await game.start();
	return game;
}
