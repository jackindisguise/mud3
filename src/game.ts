import { MudServer, MudClient } from "./io.js";
import { Character, SerializedCharacter } from "./character.js";
import { Mob } from "./dungeon.js";
import { CONFIG } from "./package/config.js";
import {
	saveCharacter as saveCharacterFile,
	loadCharacter as loadCharacterFile,
} from "./package/character.js";
import logger from "./logger.js";

/**
 * Game state and configuration
 */
// Game configuration is provided by the package config (see src/package/config.ts)

/**
 * Player authentication states during login process
 */
export enum LoginState {
	CONNECTED = "connected",
	ASKING_USERNAME = "asking_username",
	ASKING_PASSWORD = "asking_password",
	ASKING_NEW_PASSWORD = "asking_new_password",
	ASKING_CONFIRM_PASSWORD = "asking_confirm_password",
	CHARACTER_CREATION = "character_creation",
	AUTHENTICATED = "authenticated",
	PLAYING = "playing",
}

/**
 * Login session data for players going through authentication
 */
export interface LoginSession {
	client: MudClient;
	state: LoginState;
	username?: string;
	passwordAttempts: number;
	tempPassword?: string;
	character?: Character;
	lastActivity: Date;
}

/**
 * Main game orchestrator that manages the MUD server, player connections,
 * and coordinates between the network layer and game world.
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

	constructor() {
		// Use package config
		this.server = new MudServer(this.config.server.port);
	}

	/**
	 * Start the game server and begin accepting connections
	 */
	async start(): Promise<void> {
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

		// Set up auto-save timer (default 5 minutes)
		const DEFAULT_SAVE_INTERVAL = 5 * 60 * 1000;
		this.saveTimer = setInterval(() => {
			this.saveAllCharacters();
		}, DEFAULT_SAVE_INTERVAL);
	}

	/**
	 * Stop the game server and clean up resources
	 */
	async stop(): Promise<void> {
		// Clear auto-save timer
		if (this.saveTimer) {
			clearInterval(this.saveTimer);
			this.saveTimer = undefined;
		}

		// Save all characters before shutdown
		await this.saveAllCharacters();

		// End all sessions
		for (const session of Array.from(this.loginSessions)) {
			if (session.character) {
				await this.endPlayerSession(session.character);
			}
		}

		// Stop the server
		await this.server.stop();
	}

	/**
	 * Handle new client connection - start login process
	 */
	private handleNewConnection(client: MudClient): void {
		const clientAddress = client.getAddress();

		logger.info(`New connection: ${clientAddress}`);

		// Create login session
		const session: LoginSession = {
			client,
			state: LoginState.CONNECTED,
			passwordAttempts: 0,
			lastActivity: new Date(),
		};

		this.loginSessions.add(session);

		// Set up input handler for this client
		client.on("input", (input: string) => {
			this.handleClientInput(session, input);
		});

		// Start login process
		this.startLoginProcess(session);
	}

	/**
	 * Handle client disconnection
	 */
	private async handleDisconnection(client: MudClient): Promise<void> {
		const session = this.findSessionByClient(client);
		const username = session?.username;

		logger.info(
			`Client disconnected: ${client.getAddress()}${
				username ? ` (${username})` : ""
			}`
		);

		// Clean up login session
		if (session) this.loginSessions.delete(session);

		// End player session if they were playing
		if (session && session.character) {
			await this.endPlayerSession(session.character);
		}
	}

	/**
	 * Handle input from a client
	 */
	private handleClientInput(session: LoginSession, input: string): void {
		const username = session?.username;

		// Update activity timestamp
		if (session) {
			session.lastActivity = new Date();
		}

		if (session && session.state !== LoginState.PLAYING) {
			// Handle login/authentication input
			this.handleLoginInput(session, input);
		} else if (username) {
			// Handle gameplay input
			this.handleGameplayInput(session, input);
		}
	}

	/**
	 * Start the login process for a new connection
	 */
	private startLoginProcess(session: LoginSession): void {
		session.client.sendLine("Welcome to the MUD!");
		session.client.sendLine("What is your name?");
		session.state = LoginState.ASKING_USERNAME;
	}

	/**
	 * Handle input during login/authentication process
	 */
	private handleLoginInput(session: LoginSession, input: string): void {
		const trimmedInput = input.trim();

		switch (session.state) {
			case LoginState.ASKING_USERNAME:
				this.handleUsernameInput(session, trimmedInput);
				break;

			case LoginState.ASKING_PASSWORD:
				this.handlePasswordInput(session, trimmedInput);
				break;

			case LoginState.ASKING_NEW_PASSWORD:
				this.handleNewPasswordInput(session, trimmedInput);
				break;

			case LoginState.ASKING_CONFIRM_PASSWORD:
				this.handleConfirmPasswordInput(session, trimmedInput);
				break;

			case LoginState.CHARACTER_CREATION:
				this.handleCharacterCreationInput(session, trimmedInput);
				break;
		}
	}

	/**
	 * Handle gameplay input from an authenticated player
	 */
	private handleGameplayInput(session: LoginSession, input: string): void {
		const character = session.character;
		if (!character) {
			logger.error(`No active character found for session`);
			return;
		}

		// TODO: Implement command parsing and execution
		// This is where you'd integrate with your command system
		logger.debug(`${character.credentials.username} input: ${input}`);

		// For now, just echo back
		session.client.sendLine(`You said: ${input}`);
	}

	// Login process methods (simplified for now)
	private handleUsernameInput(session: LoginSession, username: string): void {
		session.username = username;
		session.client.send("Password:");
		session.state = LoginState.ASKING_PASSWORD;
	}

	private async handlePasswordInput(
		session: LoginSession,
		password: string
	): Promise<void> {
		// TODO: Implement proper authentication
		// For now, just create/load character
		session.client.sendLine("Authenticating...");

		try {
			const character = await this.authenticatePlayer(
				session.username!,
				password
			);
			if (character) {
				await this.startPlayerSession(session, character);
			} else {
				session.client.sendLine("Invalid credentials. Try again.");
				session.client.sendLine("What is your name?");
				session.state = LoginState.ASKING_USERNAME;
				session.passwordAttempts++;
			}
		} catch (error) {
			logger.error("Authentication error:", error);
			session.client.sendLine("Authentication failed. Please try again.");
			session.client.sendLine("What is your name?");
			session.state = LoginState.ASKING_USERNAME;
		}
	}

	private handleNewPasswordInput(
		session: LoginSession,
		password: string
	): void {
		// TODO: Implement new password creation
		session.tempPassword = password;
		session.client.sendLine("Confirm password:");
		session.state = LoginState.ASKING_CONFIRM_PASSWORD;
	}

	private handleConfirmPasswordInput(
		session: LoginSession,
		password: string
	): void {
		// TODO: Implement password confirmation and character creation
	}

	private handleCharacterCreationInput(
		session: LoginSession,
		input: string
	): void {
		// TODO: Implement character creation process
	}

	/**
	 * Authenticate a player and return their character
	 */
	private async authenticatePlayer(
		username: string,
		password: string
	): Promise<Character | null> {
		// TODO: Implement proper authentication with password hashing
		// TODO: Load character from persistence

		// For now, create a simple character
		const mob = new Mob();
		mob.keywords = username;
		mob.display = username;

		const character = new Character({
			credentials: {
				username,
				passwordHash: "dummy_hash", // TODO: Proper hashing
				createdAt: new Date(),
				isActive: true,
				isBanned: false,
				isAdmin: false,
			},
			mob,
		});

		return character;
	}

	/**
	 * Start a gameplay session for an authenticated character
	 */
	private async startPlayerSession(
		session: LoginSession,
		character: Character
	): Promise<void> {
		const connectionId = this.nextConnectionId++;
		const clientAddress = session.client.getAddress();

		// Start character session (attach client for convenience send helpers)
		character.startSession(connectionId, session.client);

		// Move to playing state
		session.state = LoginState.PLAYING;
		session.character = character;

		// Track active character
		this.activeCharacters.add(character);
		session.username = character.credentials.username;
		session.character = character;

		// Welcome the player
		session.client.sendLine(`Welcome back, ${character.credentials.username}!`);
		session.client.sendLine("You are now playing.");

		logger.info(`${character.credentials.username} has entered the game`);
	}

	/**
	 * End a player's session
	 */
	private async endPlayerSession(character: Character): Promise<void> {
		// End character session
		character.endSession();

		// Save character
		await this.saveCharacter(character);

		// Clean up tracking
		this.activeCharacters.delete(character);

		logger.info(`${character.credentials.username} has left the game`);
	}

	/**
	 * Save all active characters
	 */
	private async saveAllCharacters(): Promise<void> {
		logger.info(`Saving ${this.activeCharacters.size} active characters...`);

		const savePromises = Array.from(this.activeCharacters.values()).map(
			(character) => this.saveCharacter(character)
		);

		await Promise.all(savePromises);
	}

	/**
	 * Save a single character to persistence
	 */
	private async saveCharacter(character: Character): Promise<void> {
		await saveCharacterFile(character);
		logger.debug(`Saved character: ${character.credentials.username}`);
	}

	/**
	 * Load a character from persistence
	 */
	private async loadCharacter(
		username: string
	): Promise<SerializedCharacter | null> {
		const character = await loadCharacterFile(username);
		return character ? character.serialize() : null;
	}

	/**
	 * Find a login session by client
	 */
	private findSessionByClient(client: MudClient): LoginSession | undefined {
		for (const s of this.loginSessions) {
			if (s.client === client) return s;
		}
		return undefined;
	}

	/**
	 * Find an active Character by username
	 */
	private findActiveCharacterByUsername(
		username?: string
	): Character | undefined {
		if (!username) return undefined;
		for (const c of this.activeCharacters) {
			if (c.credentials.username === username) return c;
		}
		return undefined;
	}

	/**
	 * Get statistics about the current game state
	 */
	public getGameStats() {
		return {
			activeConnections: this.loginSessions.size,
			playersOnline: this.activeCharacters.size,
			loginSessions: Array.from(this.loginSessions.values()).length,
		};
	}
}

// Example usage
export async function startGame(): Promise<Game> {
	const game = new Game();

	// Handle graceful shutdown
	process.on("SIGINT", async () => {
		logger.info("Shutting down gracefully...");
		await game.stop();
		process.exit(0);
	});

	await game.start();
	return game;
}
