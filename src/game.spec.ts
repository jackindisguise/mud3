import { describe, it, before, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { EventEmitter } from "events";
import { Game, LoginState, type LoginSession } from "./game.js";
import { MudClient, MudServer } from "./io.js";
import { Character } from "./character.js";
import { Mob, Dungeon } from "./dungeon.js";

// Mock MudClient for testing
class MockMudClient extends EventEmitter {
	private _address: string;
	private _messages: string[] = [];
	private _connected = true;

	constructor(address = "127.0.0.1:12345") {
		super();
		this._address = address;
	}

	getAddress(): string {
		return this._address;
	}

	send(text: string): void {
		if (this._connected) {
			this._messages.push(text);
		}
	}

	sendLine(text: string): void {
		this.send(text + "\r\n");
	}

	close(): void {
		this._connected = false;
		this.emit("close");
	}

	isConnected(): boolean {
		return this._connected;
	}

	// Test helpers
	getMessages(): string[] {
		return [...this._messages];
	}

	clearMessages(): void {
		this._messages = [];
	}

	simulateInput(input: string): void {
		this.emit("input", input);
	}

	getLastMessage(): string | undefined {
		return this._messages[this._messages.length - 1];
	}
}

// Mock MudServer for testing
class MockMudServer extends EventEmitter {
	private _port: number;
	private _isListening = false;
	private _clients = new Set<MockMudClient>();

	constructor(port = 4000) {
		super();
		this._port = port;
	}

	async start(): Promise<void> {
		this._isListening = true;
		// Simulate async start
		setTimeout(() => this.emit("listening"), 10);
	}

	async stop(): Promise<void> {
		this._isListening = false;
		// Disconnect all clients
		for (const client of this._clients) {
			client.close();
		}
		this._clients.clear();
		this.emit("close");
	}

	isRunning(): boolean {
		return this._isListening;
	}

	getPort(): number {
		return this._port;
	}

	// Test helpers
	simulateConnection(address?: string): MockMudClient {
		const client = new MockMudClient(address);
		this._clients.add(client);

		client.on("close", () => {
			this._clients.delete(client);
			this.emit("disconnection", client);
		});

		this.emit("connection", client);
		return client;
	}

	getClientCount(): number {
		return this._clients.size;
	}
}

// Helper to create test character
function createTestCharacter(username = "testuser"): Character {
	const mob = new Mob();
	mob.keywords = username;
	mob.display = username;

	return new Character({
		credentials: {
			username,
			passwordHash: "dummy_hash",
			createdAt: new Date(),
			isActive: true,
			isBanned: false,
			isAdmin: false,
		},
		mob,
	});
}

describe("Game", () => {
	let game: Game;
	let mockServer: MockMudServer;

	beforeEach(() => {
		// Mock the MudServer in the Game class
		game = new Game();
		mockServer = new MockMudServer(23);
		// Replace the internal server with our mock
		(game as any).server = mockServer;
	});

	afterEach(async () => {
		if (game) {
			await game.stop();
		}
	});

	describe("Server Management", () => {
		it("should start the server successfully", async () => {
			let listeningEvent = false;
			mockServer.on("listening", () => {
				listeningEvent = true;
			});

			await game.start();

			// Give event loop time to process
			await new Promise((resolve) => setTimeout(resolve, 20));

			assert.strictEqual(listeningEvent, true, "Should emit listening event");
			assert.strictEqual(
				mockServer.isRunning(),
				true,
				"Server should be running"
			);
		});

		it("should stop the server successfully", async () => {
			await game.start();
			await new Promise((resolve) => setTimeout(resolve, 20));

			await game.stop();

			assert.strictEqual(
				mockServer.isRunning(),
				false,
				"Server should be stopped"
			);
		});

		it("should get correct game stats", () => {
			const stats = game.getGameStats();

			assert.strictEqual(typeof stats.activeConnections, "number");
			assert.strictEqual(typeof stats.playersOnline, "number");
			assert.strictEqual(typeof stats.loginSessions, "number");
		});
	});

	describe("Client Connections", () => {
		beforeEach(async () => {
			await game.start();
			await new Promise((resolve) => setTimeout(resolve, 20));
		});

		it("should handle new client connections", () => {
			const client = mockServer.simulateConnection("192.168.1.100:5000");

			const messages = client.getMessages();
			assert.strictEqual(
				messages.length >= 2,
				true,
				"Should send welcome messages"
			);
			assert.strictEqual(messages[0].includes("Welcome to the MUD!"), true);
			assert.strictEqual(messages[1].includes("What is your name?"), true);
		});

		it("should handle client disconnections", () => {
			const client = mockServer.simulateConnection();
			const initialStats = game.getGameStats();

			client.close();

			const finalStats = game.getGameStats();
			assert.strictEqual(
				finalStats.activeConnections,
				initialStats.activeConnections - 1
			);
		});

		it("should track multiple clients correctly", () => {
			const client1 = mockServer.simulateConnection("192.168.1.100:5000");
			const client2 = mockServer.simulateConnection("192.168.1.101:5001");

			const stats = game.getGameStats();
			assert.strictEqual(stats.activeConnections, 2);

			client1.close();

			const stats2 = game.getGameStats();
			assert.strictEqual(stats2.activeConnections, 1);
		});
	});

	describe("Login Process", () => {
		let client: MockMudClient;

		beforeEach(async () => {
			await game.start();
			await new Promise((resolve) => setTimeout(resolve, 20));
			client = mockServer.simulateConnection();
			client.clearMessages(); // Clear welcome messages
		});

		it("should handle username input", () => {
			client.simulateInput("testuser");

			const messages = client.getMessages();
			assert.strictEqual(
				messages.some((msg) => msg.includes("Password:")),
				true
			);
		});

		it("should handle password input and create character", async () => {
			client.simulateInput("testuser");
			client.clearMessages();

			client.simulateInput("testpassword");

			// Give time for async authentication
			await new Promise((resolve) => setTimeout(resolve, 20));

			const messages = client.getMessages();
			assert.strictEqual(
				messages.some((msg) => msg.includes("Authenticating...")),
				true
			);
			assert.strictEqual(
				messages.some((msg) => msg.includes("Welcome back")),
				true
			);
			assert.strictEqual(
				messages.some((msg) => msg.includes("You are now playing")),
				true
			);
		});

		it("should handle invalid authentication", async () => {
			// Mock authenticatePlayer to return null
			const originalAuth = (game as any).authenticatePlayer;
			(game as any).authenticatePlayer = async () => null;

			client.simulateInput("testuser");
			client.clearMessages();

			client.simulateInput("wrongpassword");

			// Give time for async authentication
			await new Promise((resolve) => setTimeout(resolve, 20));

			const messages = client.getMessages();
			assert.strictEqual(
				messages.some((msg) => msg.includes("Invalid credentials")),
				true
			);
			assert.strictEqual(
				messages.some((msg) => msg.includes("What is your name?")),
				true
			);

			// Restore original method
			(game as any).authenticatePlayer = originalAuth;
		});

		it("should track login session states correctly", () => {
			// Access private loginSessions for testing
			const loginSessions = (game as any).loginSessions as Set<LoginSession>;

			assert.strictEqual(
				loginSessions.size,
				1,
				"Should have one login session"
			);

			const session = Array.from(loginSessions)[0];
			assert.strictEqual(session.state, LoginState.ASKING_USERNAME);
			assert.strictEqual(session.passwordAttempts, 0);
		});
	});

	describe("Gameplay", () => {
		let client: MockMudClient;

		beforeEach(async () => {
			await game.start();
			await new Promise((resolve) => setTimeout(resolve, 20));
			client = mockServer.simulateConnection();

			// Complete login process
			client.simulateInput("testuser");
			client.simulateInput("testpassword");
			await new Promise((resolve) => setTimeout(resolve, 20));
			client.clearMessages();
		});

		it("should handle gameplay input", () => {
			client.simulateInput("look");

			const messages = client.getMessages();
			assert.strictEqual(
				messages.some((msg) => msg.includes("You said: look")),
				true
			);
		});

		it("should track active characters", () => {
			const stats = game.getGameStats();
			assert.strictEqual(stats.playersOnline, 1);
		});

		it("should handle player disconnection during gameplay", async () => {
			const statsBefore = game.getGameStats();
			assert.strictEqual(statsBefore.playersOnline, 1);

			client.close();

			// Give time for disconnect handling
			await new Promise((resolve) => setTimeout(resolve, 20));

			const statsAfter = game.getGameStats();
			assert.strictEqual(statsAfter.playersOnline, 0);
		});
	});

	describe("Session Management", () => {
		let client: MockMudClient;

		beforeEach(async () => {
			await game.start();
			await new Promise((resolve) => setTimeout(resolve, 20));
			client = mockServer.simulateConnection();

			// Complete login process
			client.simulateInput("testuser");
			client.simulateInput("testpassword");
			await new Promise((resolve) => setTimeout(resolve, 20));
		});

		it("should properly start player sessions", () => {
			const activeCharacters = (game as any).activeCharacters as Set<Character>;
			assert.strictEqual(activeCharacters.size, 1);

			const character = Array.from(activeCharacters)[0];
			assert.strictEqual(character.session !== undefined, true);
			assert.strictEqual(typeof character.session!.connectionId, "number");
		});

		it("should properly end player sessions on disconnect", async () => {
			const activeCharacters = (game as any).activeCharacters as Set<Character>;
			const character = Array.from(activeCharacters)[0];
			const initialPlaytime = character.stats.playtime;

			client.close();

			// Give time for session cleanup
			await new Promise((resolve) => setTimeout(resolve, 20));

			assert.strictEqual(character.session, undefined);
			assert.strictEqual(character.stats.playtime >= initialPlaytime, true);
		});
	});

	describe("Shutdown Process", () => {
		it("should save all characters on shutdown", async () => {
			await game.start();
			await new Promise((resolve) => setTimeout(resolve, 20));

			// Create multiple logged-in players
			const client1 = mockServer.simulateConnection("192.168.1.100:5000");
			const client2 = mockServer.simulateConnection("192.168.1.101:5001");

			// Login both clients
			client1.simulateInput("user1");
			client1.simulateInput("password1");
			client2.simulateInput("user2");
			client2.simulateInput("password2");

			await new Promise((resolve) => setTimeout(resolve, 30));

			const statsBefore = game.getGameStats();
			assert.strictEqual(statsBefore.playersOnline, 2);

			// Stop the game
			await game.stop();

			const statsAfter = game.getGameStats();
			assert.strictEqual(statsAfter.playersOnline, 0);
			assert.strictEqual(statsAfter.activeConnections, 0);
		});

		it("should clear auto-save timer on shutdown", async () => {
			await game.start();
			await new Promise((resolve) => setTimeout(resolve, 20));

			// Verify timer exists
			const saveTimer = (game as any).saveTimer;
			assert.strictEqual(saveTimer !== undefined, true);

			await game.stop();

			// Verify timer is cleared
			const saveTimerAfter = (game as any).saveTimer;
			assert.strictEqual(saveTimerAfter, undefined);
		});
	});

	describe("Error Handling", () => {
		beforeEach(async () => {
			await game.start();
			await new Promise((resolve) => setTimeout(resolve, 20));
		});

		it("should handle authentication errors gracefully", async () => {
			// Mock authenticatePlayer to throw an error
			const originalAuth = (game as any).authenticatePlayer;
			(game as any).authenticatePlayer = async () => {
				throw new Error("Database connection failed");
			};

			const client = mockServer.simulateConnection();
			client.simulateInput("testuser");
			client.clearMessages();

			client.simulateInput("testpassword");

			// Give time for async authentication
			await new Promise((resolve) => setTimeout(resolve, 20));

			const messages = client.getMessages();
			assert.strictEqual(
				messages.some((msg) => msg.includes("Authentication failed")),
				true
			);
			assert.strictEqual(
				messages.some((msg) => msg.includes("What is your name?")),
				true
			);

			// Restore original method
			(game as any).authenticatePlayer = originalAuth;
		});

		it("should handle missing character during gameplay input", () => {
			const client = mockServer.simulateConnection();
			const loginSessions = (game as any).loginSessions as Set<LoginSession>;
			const session = Array.from(loginSessions)[0];

			// Clear initial welcome messages
			client.clearMessages();

			// Manually set session to playing state without character
			session.state = LoginState.PLAYING;
			session.character = undefined;

			client.simulateInput("look");

			// Should not crash and should log error
			const messages = client.getMessages();
			assert.strictEqual(
				messages.length,
				0,
				"Should not send messages for invalid session"
			);
		});
	});
});
