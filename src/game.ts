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
import { Room, getRoomByRef, DUNGEON_REGISTRY } from "./dungeon.js";
import { isNameBlocked } from "./registry/reserved-names.js";
import { createMob } from "./package/dungeon.js";
import { Race, Job } from "./archetype.js";
import { showRoom } from "./commands/look.js";
import { CONFIG } from "./registry/config.js";
import {
	saveCharacter as saveCharacterFile,
	loadCharacter as loadCharacterFile,
	characterExists,
	isCharacterActive,
	registerActiveCharacter,
	unregisterActiveCharacter,
	checkCharacterPassword,
	loadCharacterFromSerialized,
	saveCharacter,
	setCharacterPassword,
} from "./package/character.js";
import { loadBoards, saveBoard } from "./package/board.js";
import { getBoards } from "./registry/board.js";
import { Board } from "./board.js";
import { saveGameState, getNextCharacterId } from "./package/gamestate.js";
import { executeAllDungeonResets } from "./package/dungeon.js";
import { color, COLOR } from "./color.js";
import logger from "./logger.js";
import { setAbsoluteInterval, clearCustomInterval } from "accurate-intervals";
import { getStarterRaces, getStarterJobs } from "./registry/archetype.js";
import { LINEBREAK } from "./telnet.js";
import { searchHelpfiles } from "./registry/help.js";
import { processCombatRound } from "./combat.js";
import { processWanderBehaviors } from "./behavior.js";
import { WebClientServer } from "./web-client.js";
import {
	processRegeneration,
	REGENERATION_INTERVAL_MS,
} from "./regeneration.js";

// Default intervals/timeouts (milliseconds)
export const DEFAULT_SAVE_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
export const DEFAULT_DUNGEON_RESET_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
export const DEFAULT_COMBAT_ROUND_INTERVAL_MS = 4 * 1000; // 4 seconds
export const DEFAULT_WANDER_INTERVAL_MS = 30 * 1000; // 30 seconds
export const DEFAULT_BOARD_CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

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
	// in case the connection closes, we need access to the name being created somewhere on the session
	creatingName?: string;
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

	/** Names currently being created (to prevent simultaneous creation conflicts) */
	private namesInCreation = new Set<string>();

	/** Track last command time per character to detect rapid successive commands */
	private lastCommandTime = new Map<Character, number>();

	private saveTimer?: number;
	private boardCleanupTimer?: number;
	private gameStateSaveTimer?: number;
	private dungeonResetTimer?: number;
	private combatTimer?: number;
	private wanderTimer?: number;
	private regenerationTimer?: number;
	private nextConnectionId = 1;

	/** Web client server (optional) */
	private webClientServer?: WebClientServer;

	/** Static singleton instance of the Game */
	public static game?: Game;

	constructor() {
		// Use package config
		this.server = new MudServer();
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

		session.inactivityTimer = setTimeout(async () => {
			logger.debug(
				`Inactivity timeout for ${session.character?.credentials.username}`
			);
			await this.endPlayerSession(session);
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
			this.handleDisconnection(client).catch((error) => {
				logger.error("Error handling disconnection:", error);
			});
		});

		// Start the server
		await this.server.start(this.config.server.port);

		// Start web client server if enabled in config
		const webClientEnabled = true;
		if (webClientEnabled) {
			const webClientPort = 8080;
			this.webClientServer = new WebClientServer(webClientPort);
			this.webClientServer.on("connection", (client: MudClient) => {
				this.handleNewConnection(client);
			});
			this.webClientServer.on("disconnection", (client: MudClient) => {
				this.handleDisconnection(client).catch((error) => {
					logger.error("Error handling disconnection:", error);
				});
			});
			await this.webClientServer.start();
		}

		// Set up auto-save timer
		this.saveTimer = setAbsoluteInterval(() => {
			this.saveAllCharacters();
		}, DEFAULT_SAVE_INTERVAL_MS);

		// Set up board cleanup timer (runs every hour)
		this.cleanupExpiredBoardMessages();
		this.boardCleanupTimer = setAbsoluteInterval(() => {
			this.cleanupExpiredBoardMessages();
		}, DEFAULT_BOARD_CLEANUP_INTERVAL_MS); // 1 hour

		// Set up periodic game state save (every 5 minutes)
		this.gameStateSaveTimer = setAbsoluteInterval(() => {
			this.saveGameState();
		}, DEFAULT_SAVE_INTERVAL_MS);

		// Set up dungeon reset timer
		executeAllDungeonResets();
		this.dungeonResetTimer = setAbsoluteInterval(() => {
			executeAllDungeonResets();
		}, DEFAULT_DUNGEON_RESET_INTERVAL_MS);

		// Set up combat round timer (every 3 seconds)
		this.combatTimer = setAbsoluteInterval(() => {
			processCombatRound();
		}, DEFAULT_COMBAT_ROUND_INTERVAL_MS);

		// Run initial wander cycle after dungeons are loaded
		processWanderBehaviors();

		// Set up wander behavior timer (every 30 seconds)
		this.wanderTimer = setAbsoluteInterval(() => {
			processWanderBehaviors();
		}, DEFAULT_WANDER_INTERVAL_MS);

		// Set up regeneration timer (every 30 seconds)
		this.regenerationTimer = setAbsoluteInterval(() => {
			processRegeneration();
		}, REGENERATION_INTERVAL_MS);
	}

	/**
	 * Stop the game server and clean up resources.
	 *
	 * Clears auto-save, persists all characters, ends sessions, and closes the server.
	 */
	async stop() {
		// Clear auto-save timer
		if (this.saveTimer !== undefined) {
			clearCustomInterval(this.saveTimer);
			this.saveTimer = undefined;
			logger.debug("Auto-save timer cleared");
		}

		// Clear board cleanup timer
		if (this.boardCleanupTimer !== undefined) {
			clearCustomInterval(this.boardCleanupTimer);
			this.boardCleanupTimer = undefined;
			logger.debug("Board cleanup timer cleared");
		}

		// Clear game state save timer
		if (this.gameStateSaveTimer !== undefined) {
			clearCustomInterval(this.gameStateSaveTimer);
			this.gameStateSaveTimer = undefined;
			logger.debug("Game state save timer cleared");
		}

		// Clear dungeon reset timer
		if (this.dungeonResetTimer !== undefined) {
			clearCustomInterval(this.dungeonResetTimer);
			this.dungeonResetTimer = undefined;
			logger.debug("Dungeon reset timer cleared");
		}

		// Clear combat timer
		if (this.combatTimer !== undefined) {
			clearCustomInterval(this.combatTimer);
			this.combatTimer = undefined;
			logger.debug("Combat timer cleared");
		}

		// Clear wander timer
		if (this.wanderTimer !== undefined) {
			clearCustomInterval(this.wanderTimer);
			this.wanderTimer = undefined;
			logger.debug("Wander timer cleared");
		}

		// Clear regeneration timer
		if (this.regenerationTimer !== undefined) {
			clearCustomInterval(this.regenerationTimer);
			this.regenerationTimer = undefined;
			logger.debug("Regeneration timer cleared");
		}

		// Save game state before shutdown
		await this.saveGameState();

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

		logger.debug("All sessions ended, saving boards");
		// Save all boards before shutting down
		await this.saveAllBoards();

		// Stop web client server if running
		if (this.webClientServer) {
			await this.webClientServer.stop();
			this.webClientServer = undefined;
		}

		logger.debug("All boards saved, stopping server");
		// Stop the server (this will trigger disconnection events, but sessions are already cleared)
		await this.server.stop();
		logger.debug("Server stopped successfully");
	}

	/**
	 * Block a name from being used during character creation.
	 * @param name The name to block (will be normalized to lowercase)
	 * @param session The login session creating this character
	 */
	private blockName(name: string): void {
		const normalizedName = name.toLowerCase();
		this.namesInCreation.add(normalizedName);
	}

	/**
	 * Unblock a name that was being used during character creation.
	 * @param session The login session that was creating the character
	 */
	private unblockName(name: string): void {
		const normalizedName = name.toLowerCase();
		this.namesInCreation.delete(normalizedName);
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

		// Clean up name in creation if they were creating a character
		if (session.creatingName) this.unblockName(session.creatingName);

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
		let colorEnabled = true;
		let selectedRace: Race | undefined;
		let selectedJob: Job | undefined;

		const starterRaces = getStarterRaces();
		const starterJobs = getStarterJobs();

		const formatDescription = (text?: string): string => {
			const normalized = text?.replace(/\s+/g, " ").trim();
			return normalized && normalized.length > 0
				? normalized
				: "No description provided.";
		};

		const listOptions = (
			heading: string,
			options: ReadonlyArray<{ name: string; description?: string }>,
			infoHint?: string
		) => {
			sendLine("");
			sendLine(heading);
			if (options.length === 0) {
				sendLine("  (none available)");
				sendLine("");
				return;
			}
			options.forEach((option, index) => {
				const prefix = String(index + 1).padStart(2, " ");
				sendLine(
					`  ${prefix}. ${option.name} - ${formatDescription(
						option.description
					)}`
				);
			});
			sendLine("");
			if (infoHint) {
				sendLine(infoHint);
				sendLine("");
			}
		};

		const showHelpfile = (topic: string, category: "race" | "job") => {
			const normalized = topic.trim().toLowerCase();
			if (!normalized) {
				sendLine(`Usage: !info <${category} name>`);
				return;
			}
			const helpfile = searchHelpfiles(`${category}-${normalized}`);
			if (!helpfile.bestMatch) {
				sendLine(
					`No ${category} information found for "${topic}". Try another name.`
				);
				return;
			}
			sendLine("");
			sendLine(helpfile.bestMatch.content.split("\n").slice(2).join(LINEBREAK));
			sendLine("");
		};

		const maybeHandleInfoCommand = (
			rawInput: string | undefined,
			category: "race" | "job"
		): boolean => {
			const trimmed = rawInput?.trim();
			if (!trimmed || !trimmed.toLowerCase().startsWith("!info")) {
				return false;
			}
			const topic = trimmed.slice("!info".length).trim();

			// Check if topic is a number - if so, look up by index
			const numericChoice = Number.parseInt(topic, 10);
			if (!Number.isNaN(numericChoice)) {
				const options = category === "race" ? starterRaces : starterJobs;
				const index = numericChoice - 1;
				if (index >= 0 && index < options.length) {
					const selected = options[index];
					showHelpfile(selected.name, category);
					return true;
				} else {
					sendLine(
						`Invalid ${category} number. Please choose a number between 1 and ${options.length}.`
					);
					return true;
				}
			}

			// Otherwise, treat as name/partial name
			showHelpfile(topic, category);
			return true;
		};

		const resolveSelection = <T extends { id: string; name: string }>(
			input: string | undefined,
			options: ReadonlyArray<T>
		): T | undefined => {
			if (options.length === 0) return undefined;
			if (!input || input.trim().length === 0) {
				return undefined; // Empty input should not auto-select
			}
			const trimmed = input.trim();
			const numericChoice = Number.parseInt(trimmed, 10);
			if (!Number.isNaN(numericChoice)) {
				const index = numericChoice - 1;
				if (index >= 0 && index < options.length) {
					return options[index];
				}
			}
			const normalized = trimmed.toLowerCase();

			// First try exact matches
			const exactMatch = options.find(
				(option) =>
					option.id.toLowerCase() === normalized ||
					option.name.toLowerCase() === normalized
			);
			if (exactMatch) return exactMatch;

			// Then try partial matches (prefix matching)
			const partialMatches = options.filter(
				(option) =>
					option.id.toLowerCase().startsWith(normalized) ||
					option.name.toLowerCase().startsWith(normalized)
			);

			// If exactly one match, return it
			if (partialMatches.length === 1) {
				return partialMatches[0];
			}

			// If multiple matches, return undefined (ambiguous)
			// If no matches, return undefined
			return undefined;
		};

		const chooseJob = (showList: boolean = false) => {
			if (starterJobs.length === 0) {
				sendLine(
					"No jobs are currently available. A default job will be assigned."
				);
				selectedJob = undefined;
				MOTD();
				return;
			}

			if (showList) {
				listOptions(
					"Available jobs:",
					starterJobs,
					"Type !info <job name> to read its helpfile."
				);
			}

			ask("Choose your job (name or number):", (input) => {
				if (maybeHandleInfoCommand(input, "job")) {
					return chooseJob(false);
				}
				const trimmed = input?.trim().toLowerCase();
				if (trimmed === "!list") {
					return chooseJob(true);
				}
				// Handle empty input - just re-prompt
				if (!input || trimmed.length === 0) {
					return chooseJob(false);
				}
				const choice = resolveSelection(input, starterJobs);
				if (!choice) {
					sendLine("That job wasn't recognized. Please pick again.");
					return chooseJob(false);
				}
				selectedJob = choice as Job;
				sendLine(`Job locked in: ${choice.name}.`);
				MOTD();
			});
		};

		const chooseRace = (showList: boolean = true) => {
			if (starterRaces.length === 0) {
				sendLine(
					"No races are currently available. A default race will be assigned."
				);
				selectedRace = undefined;
				chooseJob();
				return;
			}

			if (showList) {
				listOptions(
					"Available races:",
					starterRaces,
					"Type !info <race name> to read its helpfile."
				);
			}

			ask("Choose your race (name or number):", (input) => {
				if (maybeHandleInfoCommand(input, "race")) {
					return chooseRace(false);
				}
				const trimmed = input?.trim().toLowerCase();
				if (trimmed === "!list") {
					return chooseRace(true);
				}
				// Handle empty input - just re-prompt
				if (!input || trimmed.length === 0) {
					return chooseRace(false);
				}
				const choice = resolveSelection(input, starterRaces);
				if (!choice) {
					sendLine("That race wasn't recognized. Please pick again.");
					return chooseRace(false);
				}
				selectedRace = choice as Race;
				sendLine(`Race locked in: ${choice.name}.`);
				chooseJob(true);
			});
		};

		const send = (line: string) => client.send(line, colorEnabled);
		const sendLine = (line: string) => client.sendLine(line, colorEnabled);
		const ask = (question: string, callback: (input: string) => void) =>
			client.ask(question, callback, colorEnabled);
		const yesno = (
			question: string,
			callback: (yesorno: boolean | undefined) => void
		) => client.yesno(question, callback, colorEnabled);

		sendLine("Welcome to the MUD!");

		const askName = () => {
			ask("What is your name?", async (input) => {
				if (!input) return askName();

				const trimmed = input.trim();
				if (trimmed.length === 0) {
					return askName();
				}

				// Check if name is blocked
				if (isNameBlocked(trimmed)) {
					sendLine("That name is not allowed. Please choose a different name.");
					return askName();
				}

				// can't login to character that's online
				if (isCharacterActive(trimmed)) {
					sendLine("That character is already playing.");
					return askName();
				}

				// Check if name is currently being created by someone else
				if (self.namesInCreation.has(trimmed.toLowerCase())) {
					sendLine(
						"That name is currently in use. Please choose another name."
					);
					return askName();
				}

				username = trimmed; // save username

				// new name, start making a character
				if (!(await characterExists(trimmed))) {
					return confirmCharacterCreation();
				} else {
					return confirmExistingCharacterPassword();
				}
			});
		};

		const confirmExistingCharacterPassword = () => {
			ask("Password:", async (_password) => {
				// Check password and get serialized character data
				const serializedCharacter = await checkCharacterPassword(
					username,
					_password
				);
				if (!serializedCharacter) {
					sendLine("Invalid password. Disconnecting.");
					client.close();
					return;
				}

				if (!serializedCharacter.mob) {
					sendLine("Character data is corrupted. Disconnecting.");
					client.close();
					return;
				}

				// Load the character from serialized data
				const loadedCharacter =
					loadCharacterFromSerialized(serializedCharacter);

				// Get the saved location reference from the serialized data
				const savedLocationRef = serializedCharacter.mob?.location as
					| string
					| undefined;

				// Password is correct, show MOTD and start session
				MOTD(loadedCharacter, savedLocationRef);
			});
		};

		const confirmCharacterCreation = () => {
			yesno(
				`Do you wish to create a character named '${username}'?`,
				(yesorno) => {
					if (yesorno === true) {
						// Add name to in-creation set and track in session
						self.blockName(username);
						session.creatingName = username;
						return getNewPassword();
					} else if (yesorno === false) {
						// User cancelled, clean up if name was being created
						self.unblockName(username);
						delete session.creatingName;
						return askName();
					} else return confirmCharacterCreation();
				}
			);
		};

		const getNewPassword = () => {
			ask("Please enter a password:", (_password) => {
				if (!_password) return getNewPassword();
				if (_password.length < 5) {
					sendLine("It needs to be longer than 5 characters.");
					return getNewPassword();
				}
				password = _password;
				confirmNewPassword();
			});
		};

		const confirmNewPassword = () => {
			ask("Please re-type your password:", (_password) => {
				if (_password != password) {
					sendLine("Those passwords don't match! Try again.");
					return getNewPassword();
				}
				chooseRace();
			});
		};

		const MOTD = async (
			existingCharacter?: Character,
			savedLocationRef?: string
		) => {
			sendLine("This is the MOTD.");
			ask("Press any key to continue...", async () => {
				let character: Character;
				let isNewCharacter = false;
				let locationRef: string | undefined;

				if (existingCharacter) {
					// Use the loaded existing character
					character = existingCharacter;
					locationRef = savedLocationRef;
				} else {
					// Create a new character
					isNewCharacter = true;
					const characterId = await getNextCharacterId();
					const mob = createMob({
						display: username,
						keywords: username,
						race: selectedRace,
						job: selectedJob,
					});
					character = new Character({
						credentials: { username, characterId },
						mob,
					});
					setCharacterPassword(character, password);
					saveCharacterFile(character);
					// Remove name from in-creation set now that character is created
					self.unblockName(username);
					delete session.creatingName;
				}

				self.startPlayerSession(
					session,
					character,
					isNewCharacter,
					locationRef
				);
			});
		};

		logger.debug(`calling askName() to start login process for ${client}`);

		// We check by username after they enter it, or we can check immediately
		// For now, we'll check after they enter their name
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

		const now = Date.now();
		const lastTime = this.lastCommandTime.get(character);
		const BATCH_WINDOW_MS = 10; // Commands within 100ms are considered rapid succession
		const isRapidSuccession =
			lastTime !== undefined && now - lastTime < BATCH_WINDOW_MS;

		// Track this command time
		this.lastCommandTime.set(character, now);

		const echoMode = character.settings.echoMode ?? "client";
		if (echoMode === "client" || echoMode === "server" || isRapidSuccession) {
			const charSession = character.session;
			if (charSession) charSession.lastMessageGroup = undefined;
			if (echoMode === "server" && character.session?.client) {
				charSession?.client?.sendLine(input);
			} else if (isRapidSuccession) {
				character.send(LINEBREAK);
			}
		}

		logger.debug(`${character.credentials.username} input: ${input}`);

		// generate the context
		const context: CommandContext = {
			actor: character.mob!,
			room:
				character.mob!.location instanceof Room
					? character.mob!.location
					: undefined,
		};
		const executed = CommandRegistry.default.execute(input, context);
		if (!executed) {
			character.sendMessage("Do what?", MESSAGE_GROUP.COMMAND_RESPONSE);
		}
		character.showPrompt();
	}

	/**
	 * Start a gameplay session for an authenticated character.
	 * Associates the connection, transitions to PLAYING, and welcomes the player.
	 * Moves the character to their saved location (or starting location for new characters).
	 *
	 * @param session The login session
	 * @param character The character to start a session for
	 * @param isNewCharacter Whether this is a newly created character
	 * @param savedLocationRef Optional room reference string from saved character data
	 */
	private startPlayerSession(
		session: LoginSession,
		character: Character,
		isNewCharacter: boolean = false,
		savedLocationRef?: string
	) {
		const connectionId = this.nextConnectionId++;

		// Save last login date before updating it
		const lastLoginDate = character.credentials.lastLogin;

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
		if (isNewCharacter) {
			character.sendLine(`Welcome, ${character.credentials.username}!`);
		} else {
			character.sendLine(`Welcome back, ${character.credentials.username}!`);
		}
		character.sendLine("You are now playing.");

		logger.info(`${character.credentials.username} has entered the game`);

		// Move character to their location
		let targetRoom: Room | undefined;
		if (isNewCharacter) {
			// New characters start at @tower{0,0,0}
			targetRoom = getRoomByRef("@tower{0,0,0}");
			if (!targetRoom) {
				logger.warn(
					`Failed to find starting room @tower{0,0,0} for new character ${character.credentials.username}`
				);
				character.sendMessage(
					"Warning: Could not find starting location. Please contact an administrator.",
					MESSAGE_GROUP.COMMAND_RESPONSE
				);
			}
		} else {
			// Existing characters: restore from saved location
			if (savedLocationRef) {
				targetRoom = getRoomByRef(savedLocationRef);
				if (!targetRoom) {
					logger.warn(
						`Failed to restore location ${savedLocationRef} for character ${character.credentials.username}, falling back to starting location`
					);
					// Fall back to starting location
					targetRoom = getRoomByRef("@tower{0,0,0}");
					if (!targetRoom) {
						logger.error(
							`Failed to find fallback starting room @tower{0,0,0} for character ${character.credentials.username}`
						);
						character.sendMessage(
							"Warning: Could not restore your location. Please contact an administrator.",
							MESSAGE_GROUP.COMMAND_RESPONSE
						);
					}
				}
			} else {
				// No saved location, use starting location
				targetRoom = getRoomByRef("@tower{0,0,0}");
				if (!targetRoom) {
					logger.warn(
						`No saved location and failed to find starting room @tower{0,0,0} for character ${character.credentials.username}`
					);
					character.sendMessage(
						"Warning: Could not find starting location. Please contact an administrator.",
						MESSAGE_GROUP.COMMAND_RESPONSE
					);
				}
			}
		}

		// Check for unread messages
		this.checkUnreadMessages(character, lastLoginDate);

		// Move the character to the target room and show it
		if (targetRoom) {
			targetRoom.add(character.mob!);
			showRoom(character.mob!, targetRoom);
		}
		character.showPrompt();

		// Wire gameplay input handler now that the player is in the world
		session.client.on("input", (line: string) => {
			this.handleClientInput(session, line);
		});
	}

	/**
	 * Check for unread messages on boards and notify the character.
	 * Shows two types of alerts:
	 * 1. General board activity: boards with new messages since last login
	 * 2. Direct messages: messages specifically targeted at the character
	 *
	 * @param character - The character to check for unread messages
	 * @param lastLoginDate - The character's last login date (before current session)
	 */
	private async checkUnreadMessages(
		character: Character,
		lastLoginDate: Date
	): Promise<void> {
		try {
			let boards = getBoards();
			const username = character.credentials.username.toLowerCase();
			const boardActivity: Array<{
				board: Board;
				count: number;
			}> = [];
			const directMessages: Array<{
				board: Board;
				messageId: number;
				author: string;
			}> = [];

			for (const board of boards) {
				// Check if user has access to this board
				// If board is admin-only and user is not admin, skip it
				if (board.writePermission === "admin" && !character.isAdmin()) {
					continue;
				}

				// Get all messages posted after last login
				const messages = board.getAllMessages();
				let newMessageCount = 0;

				for (const message of messages) {
					const messageDate = new Date(message.postedAt);

					// Check if message was posted after last login
					if (messageDate <= lastLoginDate) {
						continue;
					}

					newMessageCount++;

					// Check if message is targeted at this user
					if (message.targets && message.targets.length > 0) {
						const isTarget = message.targets.some(
							(target) => target.toLowerCase() === username
						);
						if (isTarget) {
							directMessages.push({
								board,
								messageId: message.id,
								author: message.author,
							});
						}
					}
				}

				// Track board activity if there are new messages
				if (newMessageCount > 0) {
					boardActivity.push({
						board,
						count: newMessageCount,
					});
				}
			}

			// Buffer all message lines
			const messageLines: string[] = [];

			// Add general board activity
			if (boardActivity.length > 0) {
				messageLines.push("");
				messageLines.push(
					color("=== New Messages on Boards ===", COLOR.YELLOW)
				);
				for (const activity of boardActivity) {
					const messageText = activity.count === 1 ? "message" : "messages";
					messageLines.push(
						`  ${color("*", COLOR.CYAN)} ${color(
							activity.board.displayName,
							COLOR.LIME
						)} has ${color(
							activity.count.toString(),
							COLOR.YELLOW
						)} new ${messageText}.`
					);
				}
				messageLines.push("");
			}

			// Add direct messages
			if (directMessages.length > 0) {
				messageLines.push(
					color("=== Unread Direct Messages ===", COLOR.PURPLE)
				);
				for (const msg of directMessages) {
					messageLines.push(
						`  ${color("*", COLOR.CYAN)} New message from ${color(
							msg.author,
							COLOR.LIME
						)} on the ${color(msg.board.displayName, COLOR.YELLOW)} board.`
					);
					messageLines.push(
						`    ${color("Type:", COLOR.SILVER)} ${color(
							`board ${msg.board.name} read ${msg.messageId}`,
							COLOR.CYAN
						)}`
					);
				}
				messageLines.push("");
			}

			// Send all buffered lines in a single message
			if (messageLines.length > 0) {
				character.sendMessage(messageLines.join("\n"), MESSAGE_GROUP.SYSTEM);
			}
		} catch (error) {
			logger.error(
				`Failed to check unread messages for ${character.credentials.username}: ${error}`
			);
		}
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
		if (session.character.mob) await saveCharacterFile(session.character);

		logger.info(`${session.character} has left the game`);
		const name = session.character.toString();

		// Destroy the mob (clears all references and prepares for garbage collection)
		if (session.character.mob) {
			session.character.mob.destroy();
			logger.info(`${name} has been destroyed`);
		}

		// Clean up tracking
		this.activeCharacters.delete(session.character);

		// Clean up command tracking
		this.lastCommandTime.delete(session.character);

		// Remove from character package registry (local lock)
		unregisterActiveCharacter(session.character);

		logger.info(`${name} has been removed from active characters`);
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
	 * Clean up expired messages from all boards.
	 */
	private async cleanupExpiredBoardMessages() {
		try {
			let boards = getBoards();
			let totalRemoved = 0;

			for (const board of boards) {
				const removed = board.removeExpiredMessages();
				if (removed > 0) {
					await saveBoard(board);
					totalRemoved += removed;
					logger.debug(
						`Removed ${removed} expired message(s) from board "${board.name}"`
					);
				}
			}

			if (totalRemoved > 0) {
				logger.info(
					`Board cleanup: removed ${totalRemoved} expired message(s) total`
				);
			}
		} catch (error) {
			logger.error(`Error during board cleanup: ${error}`);
		}
	}

	/**
	 * Save all boards to disk.
	 */
	private async saveAllBoards() {
		try {
			let boards = getBoards();
			if (boards.length === 0) return;

			logger.info(`Saving ${boards.length} board(s)...`);

			const savePromises = boards.map((board) => saveBoard(board));
			await Promise.all(savePromises);

			logger.info(`All boards saved successfully`);
		} catch (error) {
			logger.error(`Error saving boards: ${error}`);
		}
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
				if (session.character) session.character.sendLine(text);
				else session.client.sendLine(text, false);
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

	/**
	 * Save game state to disk.
	 */
	private async saveGameState(): Promise<void> {
		try {
			await saveGameState();
		} catch (error) {
			logger.error(`Failed to save game state: ${error}`);
		}
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
