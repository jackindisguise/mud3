import { test, suite } from "node:test";
import assert from "node:assert";
import {
	Character,
	CharacterOptions,
	SerializedCharacter,
	PlayerCredentials,
	PlayerSettings,
	PlayerStats,
	DEFAULT_PLAYER_SETTINGS,
	DEFAULT_PLAYER_STATS,
	DEFAULT_PLAYER_CREDENTIALS,
	RequiredPlayerCredentials,
} from "./character.js";
import { Mob, Dungeon } from "./dungeon.js";
import type { MudClient } from "./io.js";

suite("character.ts", () => {
	// Helper function to create test credentials
	function createTestCredentials(
		overrides: Partial<PlayerCredentials> = {}
	): PlayerCredentials {
		return {
			username: "testuser",
			passwordHash: "hashed_password_123",
			email: "test@example.com",
			createdAt: new Date("2025-01-01T00:00:00Z"),
			lastLogin: new Date("2025-01-02T00:00:00Z"),
			isActive: true,
			isBanned: false,
			isAdmin: false,
			...overrides,
		};
	}

	// Helper function to create a test character
	function createTestCharacter(
		overrides: Partial<CharacterOptions> = {}
	): Character {
		const mob = new Mob();
		const defaultOptions: CharacterOptions = {
			credentials: createTestCredentials(),
			mob: mob,
		};

		return new Character({ ...defaultOptions, ...overrides });
	}

	// Helper to create a lightweight mock MudClient for session tests
	function createMockClient(): MudClient {
		const mock = {
			send: (_text: string) => {},
			sendLine: (_text: string) => {},
			close: () => {},
			getAddress: () => "test:0",
			isConnected: () => true,
		};
		return mock as unknown as MudClient;
	}

	suite("Constructor", () => {
		test("should create character with provided credentials", () => {
			const credentials = createTestCredentials();
			const mob = new Mob();
			const character = new Character({ credentials, mob });

			assert.strictEqual(character.credentials.username, "testuser");
			assert.strictEqual(
				character.credentials.passwordHash,
				"hashed_password_123"
			);
			assert.strictEqual(character.credentials.email, "test@example.com");
			assert.strictEqual(character.credentials.isActive, true);
			assert.strictEqual(character.credentials.isBanned, false);
			assert.strictEqual(character.credentials.isAdmin, false);
		});

		test("should apply default settings when none provided", () => {
			const character = createTestCharacter();

			assert.deepStrictEqual(character.settings, DEFAULT_PLAYER_SETTINGS);
		});

		test("should merge custom settings with defaults", () => {
			const customSettings: Partial<PlayerSettings> = {
				verboseMode: false,
				colorEnabled: false,
			};

			const character = createTestCharacter({ settings: customSettings });

			assert.strictEqual(character.settings.verboseMode, false);
			assert.strictEqual(character.settings.colorEnabled, false);
			// Should still have defaults for unspecified settings
			assert.strictEqual(
				character.settings.receiveOOC,
				DEFAULT_PLAYER_SETTINGS.receiveOOC
			);
			assert.strictEqual(
				character.settings.prompt,
				DEFAULT_PLAYER_SETTINGS.prompt
			);
		});

		test("should apply default stats when none provided", () => {
			const character = createTestCharacter();

			assert.deepStrictEqual(character.stats, DEFAULT_PLAYER_STATS);
		});

		test("should merge custom stats with defaults", () => {
			const customStats: Partial<PlayerStats> = {
				playtime: 5000,
				kills: 10,
			};

			const character = createTestCharacter({ stats: customStats });

			assert.strictEqual(character.stats.playtime, 5000);
			assert.strictEqual(character.stats.kills, 10);
			// Should still have default for unspecified stats
			assert.strictEqual(character.stats.deaths, DEFAULT_PLAYER_STATS.deaths);
		});

		test("should establish bidirectional relationship with mob", () => {
			const mob = new Mob();
			const character = createTestCharacter({ mob });

			assert.strictEqual(character.mob, mob);
			assert.strictEqual(mob.character, character);
		});

		test("should initialize with no active session", () => {
			const character = createTestCharacter();

			assert.strictEqual(character.session, undefined);
		});
	});

	suite("Mob Relationship", () => {
		test("should update bidirectional relationship when setting new mob", () => {
			const character = createTestCharacter();
			const oldMob = character.mob;
			const newMob = new Mob();

			character.mob = newMob;

			assert.strictEqual(character.mob, newMob);
			assert.strictEqual(newMob.character, character);
			assert.strictEqual(oldMob.character, undefined);
		});

		test("should handle setting mob that already has character relationship", () => {
			const character1 = createTestCharacter();
			const character2 = createTestCharacter();
			const mob = character1.mob;

			// Set mob to character2, should break relationship with character1
			character2.mob = mob;

			assert.strictEqual(character2.mob, mob);
			assert.strictEqual(mob.character, character2);
			assert.notStrictEqual(character1.mob, mob);
		});
	});

	suite("Session Management", () => {
		test("should handle starting a session correctly", () => {
			const character = createTestCharacter();
			const beforeLogin = Date.now();
			const connectionId = 12345;

			character.startSession(connectionId, createMockClient());

			assert(character.session !== undefined);
			assert.strictEqual(character.session.connectionId, connectionId);
			assert(character.session.startTime instanceof Date);
			assert(character.session.startTime.getTime() >= beforeLogin);
			assert.strictEqual(
				character.credentials.lastLogin,
				character.session.startTime
			);
		});

		test("should handle ending a session correctly", () => {
			const character = createTestCharacter();
			const initialPlaytime = character.stats.playtime;
			const connectionId = 12345;

			character.startSession(connectionId, createMockClient());
			// Simulate some time passing by modifying the session start time
			const sessionStart = character.session!.startTime;
			character.session!.startTime = new Date(sessionStart.getTime() - 5000); // 5 seconds ago

			character.endSession();

			assert.strictEqual(character.session, undefined);
			assert(character.stats.playtime >= initialPlaytime + 5000);
		});

		test("should handle ending session when not started", () => {
			const character = createTestCharacter();
			const initialPlaytime = character.stats.playtime;

			character.endSession(); // Should not throw

			assert.strictEqual(character.session, undefined);
			assert.strictEqual(character.stats.playtime, initialPlaytime);
		});

		test("should calculate session duration correctly", () => {
			const character = createTestCharacter();
			const connectionId = 12345;

			// No session
			assert.strictEqual(character.getSessionDuration(), 0);

			character.startSession(connectionId, createMockClient());
			// Set session start to 10 seconds ago
			character.session!.startTime = new Date(Date.now() - 10000);

			const duration = character.getSessionDuration();
			assert(duration >= 9900 && duration <= 10100); // Allow for small timing variations
		});
	});

	suite("Settings Management", () => {
		test("should update settings correctly", () => {
			const character = createTestCharacter();
			const originalPrompt = character.settings.prompt;

			character.updateSettings({
				verboseMode: false,
				prompt: "$ ",
				colorEnabled: false,
			});

			assert.strictEqual(character.settings.verboseMode, false);
			assert.strictEqual(character.settings.prompt, "$ ");
			assert.strictEqual(character.settings.colorEnabled, false);
			// Other settings should remain unchanged
			assert.strictEqual(
				character.settings.receiveOOC,
				DEFAULT_PLAYER_SETTINGS.receiveOOC
			);
		});

		test("should handle partial settings updates", () => {
			const character = createTestCharacter();

			character.updateSettings({ verboseMode: false });

			assert.strictEqual(character.settings.verboseMode, false);
			// All other settings should remain as defaults
			assert.strictEqual(
				character.settings.colorEnabled,
				DEFAULT_PLAYER_SETTINGS.colorEnabled
			);
			assert.strictEqual(
				character.settings.prompt,
				DEFAULT_PLAYER_SETTINGS.prompt
			);
		});
	});

	suite("Statistics Tracking", () => {
		test("should record deaths correctly", () => {
			const character = createTestCharacter();
			const initialDeaths = character.stats.deaths;

			character.recordDeath();
			assert.strictEqual(character.stats.deaths, initialDeaths + 1);

			character.recordDeath();
			assert.strictEqual(character.stats.deaths, initialDeaths + 2);
		});

		test("should record kills correctly", () => {
			const character = createTestCharacter();
			const initialKills = character.stats.kills;

			character.recordKill();
			assert.strictEqual(character.stats.kills, initialKills + 1);

			character.recordKill();
			assert.strictEqual(character.stats.kills, initialKills + 2);
		});

		test("should format playtime correctly for minutes only", () => {
			const character = createTestCharacter();
			character.stats.playtime = 30 * 60 * 1000; // 30 minutes

			const formatted = character.getFormattedPlaytime();
			assert.strictEqual(formatted, "30 minutes");
		});

		test("should format playtime correctly for hours and minutes", () => {
			const character = createTestCharacter();
			character.stats.playtime = (2 * 60 * 60 + 45 * 60) * 1000; // 2 hours 45 minutes

			const formatted = character.getFormattedPlaytime();
			assert.strictEqual(formatted, "2 hours, 45 minutes");
		});

		test("should include current session time in formatted playtime", () => {
			const character = createTestCharacter();
			character.stats.playtime = 30 * 60 * 1000; // 30 minutes base
			const connectionId = 12345;

			character.startSession(connectionId, createMockClient());
			character.session!.startTime = new Date(Date.now() - 15 * 60 * 1000); // 15 minutes ago

			const formatted = character.getFormattedPlaytime();
			assert.strictEqual(formatted, "45 minutes");
		});
	});

	suite("Authorization", () => {
		test("should correctly identify admin status", () => {
			const regularCharacter = createTestCharacter();
			const adminCharacter = createTestCharacter({
				credentials: createTestCredentials({ isAdmin: true }),
			});

			assert.strictEqual(regularCharacter.isAdmin(), false);
			assert.strictEqual(adminCharacter.isAdmin(), true);
		});

		test("should correctly check if character can play when active", () => {
			const character = createTestCharacter();

			assert.strictEqual(character.canPlay(), true);
		});

		test("should correctly check if character can play when inactive", () => {
			const character = createTestCharacter({
				credentials: createTestCredentials({ isActive: false }),
			});

			assert.strictEqual(character.canPlay(), false);
		});

		test("should correctly check if character can play when banned", () => {
			const character = createTestCharacter({
				credentials: createTestCredentials({ isBanned: true }),
			});

			assert.strictEqual(character.canPlay(), false);
		});

		test("should correctly check if character can play when inactive and banned", () => {
			const character = createTestCharacter({
				credentials: createTestCredentials({ isActive: false, isBanned: true }),
			});

			assert.strictEqual(character.canPlay(), false);
		});
	});

	suite("Serialization", () => {
		test("should serialize character data correctly", () => {
			const character = createTestCharacter({
				settings: { verboseMode: false, colorEnabled: false },
				stats: { playtime: 5000, deaths: 2, kills: 10 },
			});

			const serialized = character.serialize();

			assert.strictEqual(serialized.credentials.username, "testuser");
			assert.strictEqual(serialized.settings.verboseMode, false);
			assert.strictEqual(serialized.settings.colorEnabled, false);
			assert.strictEqual(serialized.stats.playtime, 5000);
			assert.strictEqual(serialized.stats.deaths, 2);
			assert.strictEqual(serialized.stats.kills, 10);
			assert.strictEqual(serialized.mob.type, "Mob");
		});

		test("should exclude runtime data from serialization", () => {
			const character = createTestCharacter();
			const connectionId = 12345;
			character.startSession(connectionId, createMockClient());

			const serialized = character.serialize();

			// Should not include session data
			assert.strictEqual(serialized.hasOwnProperty("session"), false);
		});
	});

	suite("Deserialization", () => {
		test("should deserialize character data correctly", () => {
			const originalCharacter = createTestCharacter({
				settings: { verboseMode: false, prompt: ">> " },
				stats: { playtime: 8000, deaths: 3, kills: 15 },
			});

			const serialized = originalCharacter.serialize();
			const deserialized = Character.deserialize(serialized);

			assert.strictEqual(
				deserialized.credentials.username,
				originalCharacter.credentials.username
			);
			assert.strictEqual(
				deserialized.credentials.passwordHash,
				originalCharacter.credentials.passwordHash
			);
			assert.strictEqual(deserialized.settings.verboseMode, false);
			assert.strictEqual(deserialized.settings.prompt, ">> ");
			assert.strictEqual(deserialized.stats.playtime, 8000);
			assert.strictEqual(deserialized.stats.deaths, 3);
			assert.strictEqual(deserialized.stats.kills, 15);
		});

		test("should establish bidirectional relationship after deserialization", () => {
			const originalCharacter = createTestCharacter();
			const serialized = originalCharacter.serialize();
			const deserialized = Character.deserialize(serialized);

			assert.strictEqual(deserialized.mob.character, deserialized);
			assert(deserialized.mob instanceof Mob);
		});

		test("should deserialize mob with correct properties", () => {
			const originalCharacter = createTestCharacter();
			originalCharacter.mob.keywords = "brave hero warrior";
			originalCharacter.mob.display = "A Brave Hero";
			originalCharacter.mob.description =
				"A courageous warrior ready for adventure.";

			const serialized = originalCharacter.serialize();
			const deserialized = Character.deserialize(serialized);

			assert.strictEqual(deserialized.mob.keywords, "brave hero warrior");
			assert.strictEqual(deserialized.mob.display, "A Brave Hero");
			assert.strictEqual(
				deserialized.mob.description,
				"A courageous warrior ready for adventure."
			);
		});

		test("should handle round-trip serialization/deserialization", () => {
			const dungeon = Dungeon.generateEmptyDungeon({
				dimensions: { width: 3, height: 3, layers: 1 },
				id: "test-dungeon",
			});
			const room = dungeon.getRoom({ x: 1, y: 1, z: 0 })!;

			const originalCharacter = createTestCharacter();
			originalCharacter.mob.keywords = "test player";
			originalCharacter.mob.display = "Test Player";
			room.add(originalCharacter.mob);

			// Serialize and deserialize
			const serialized = originalCharacter.serialize();
			const deserialized = Character.deserialize(serialized);

			// Should preserve all character data
			assert.strictEqual(
				deserialized.credentials.username,
				originalCharacter.credentials.username
			);
			assert.deepStrictEqual(deserialized.settings, originalCharacter.settings);
			assert.deepStrictEqual(deserialized.stats, originalCharacter.stats);

			// Should preserve mob data
			assert.strictEqual(
				deserialized.mob.keywords,
				originalCharacter.mob.keywords
			);
			assert.strictEqual(
				deserialized.mob.display,
				originalCharacter.mob.display
			);

			// Should establish bidirectional relationship
			assert.strictEqual(deserialized.mob.character, deserialized);
		});
	});

	suite("Default Values", () => {
		test("DEFAULT_PLAYER_SETTINGS should have correct values", () => {
			assert.strictEqual(DEFAULT_PLAYER_SETTINGS.receiveOOC, true);
			assert.strictEqual(DEFAULT_PLAYER_SETTINGS.verboseMode, true);
			assert.strictEqual(DEFAULT_PLAYER_SETTINGS.prompt, "> ");
			assert.strictEqual(DEFAULT_PLAYER_SETTINGS.colorEnabled, true);
			assert.strictEqual(DEFAULT_PLAYER_SETTINGS.autoLook, true);
			assert.strictEqual(DEFAULT_PLAYER_SETTINGS.briefMode, false);
		});

		test("DEFAULT_PLAYER_STATS should have correct values", () => {
			assert.strictEqual(DEFAULT_PLAYER_STATS.playtime, 0);
			assert.strictEqual(DEFAULT_PLAYER_STATS.deaths, 0);
			assert.strictEqual(DEFAULT_PLAYER_STATS.kills, 0);
		});

		test("DEFAULT_PLAYER_CREDENTIALS should have correct values", () => {
			assert.strictEqual(DEFAULT_PLAYER_CREDENTIALS.isActive, true);
			assert.strictEqual(DEFAULT_PLAYER_CREDENTIALS.isBanned, false);
			assert.strictEqual(DEFAULT_PLAYER_CREDENTIALS.isAdmin, false);
		});
	});

	suite("Edge Cases", () => {
		test("should handle creating character with minimal credentials", () => {
			const credentials: RequiredPlayerCredentials = { username: "minimal" };

			const mob = new Mob();
			const character = new Character({ credentials, mob });

			assert.strictEqual(character.credentials.username, "minimal");
			assert.strictEqual(character.credentials.email, undefined);
			assert.notStrictEqual(character.credentials.lastLogin, undefined);
		});

		test("should handle zero playtime formatting", () => {
			const character = createTestCharacter();
			character.stats.playtime = 0;

			const formatted = character.getFormattedPlaytime();
			assert.strictEqual(formatted, "0 minutes");
		});

		test("should handle exactly one hour playtime formatting", () => {
			const character = createTestCharacter();
			character.stats.playtime = 60 * 60 * 1000; // exactly 1 hour

			const formatted = character.getFormattedPlaytime();
			assert.strictEqual(formatted, "1 hours, 0 minutes");
		});

		test("should handle multiple settings updates", () => {
			const character = createTestCharacter();

			character.updateSettings({ verboseMode: false });
			character.updateSettings({ colorEnabled: false });
			character.updateSettings({ prompt: "$ " });

			assert.strictEqual(character.settings.verboseMode, false);
			assert.strictEqual(character.settings.colorEnabled, false);
			assert.strictEqual(character.settings.prompt, "$ ");
			// Other settings should remain as defaults
			assert.strictEqual(
				character.settings.receiveOOC,
				DEFAULT_PLAYER_SETTINGS.receiveOOC
			);
		});
	});
});
