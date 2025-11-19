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
import { CHANNEL } from "./channel.js";
import { Dungeon } from "./dungeon.js";
import { Mob } from "./dungeon.js";
import type { MudClient } from "./io.js";

suite("character.ts", () => {
	// Helper function to create test credentials
	function createTestCredentials(
		overrides: Partial<PlayerCredentials> = {}
	): PlayerCredentials {
		return {
			characterId: 1,
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
		if (overrides.credentials?.username) {
			mob.display = overrides.credentials.username;
			mob.keywords = overrides.credentials.username;
		}
		const defaultOptions: CharacterOptions = {
			credentials: createTestCredentials(),
			mob: mob,
		};

		// Ensure characterId is always present, even if credentials are overridden
		const mergedOptions = { ...defaultOptions, ...overrides };
		if (mergedOptions.credentials && !mergedOptions.credentials.characterId) {
			mergedOptions.credentials.characterId =
				defaultOptions.credentials.characterId;
		}

		return new Character(mergedOptions);
	}

	// Helper to create a lightweight mock MudClient for session tests
	function createMockClient(): MudClient & { sendHistory: string[] } {
		const sendHistory: string[] = [];
		const mock = {
			sendHistory,
			send: (text: string) => {
				sendHistory.push(text);
			},
			sendLine: (text: string) => {
				sendHistory.push(text + "\r\n");
			},
			close: () => {},
			getAddress: () => "test:0",
			isConnected: () => true,
			isLocalhost: () => false,
		};
		return mock as unknown as MudClient & { sendHistory: string[] };
	}

	function stripColorCodes(value: string): string {
		return value.replace(/\{./g, "");
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

			// Check default settings (channels is initialized separately in constructor)
			assert.strictEqual(
				character.settings.receiveOOC,
				DEFAULT_PLAYER_SETTINGS.receiveOOC
			);
			assert.strictEqual(
				character.settings.verboseMode,
				DEFAULT_PLAYER_SETTINGS.verboseMode
			);
			assert.strictEqual(
				character.settings.prompt,
				DEFAULT_PLAYER_SETTINGS.prompt
			);
			assert.strictEqual(
				character.settings.colorEnabled,
				DEFAULT_PLAYER_SETTINGS.colorEnabled
			);
			assert.strictEqual(
				character.settings.autoLook,
				DEFAULT_PLAYER_SETTINGS.autoLook
			);
			assert.strictEqual(
				character.settings.briefMode,
				DEFAULT_PLAYER_SETTINGS.briefMode
			);
			// Channels should be initialized
			assert.ok(character.settings.channels instanceof Set);
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
			assert.strictEqual(formatted, "30 minutes, 0 seconds");
		});

		test("should format playtime correctly for hours and minutes", () => {
			const character = createTestCharacter();
			character.stats.playtime = (2 * 60 * 60 + 45 * 60) * 1000; // 2 hours 45 minutes

			const formatted = character.getFormattedPlaytime();
			assert.strictEqual(formatted, "2 hours, 45 minutes, 0 seconds");
		});

		test("should include current session time in formatted playtime", () => {
			const character = createTestCharacter();
			character.stats.playtime = 30 * 60 * 1000; // 30 minutes base
			const connectionId = 12345;

			character.startSession(connectionId, createMockClient());
			character.session!.startTime = new Date(Date.now() - 15 * 60 * 1000); // 15 minutes ago

			const formatted = character.getFormattedPlaytime();
			assert.strictEqual(formatted, "45 minutes, 0 seconds");
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
			assert.strictEqual(
				DEFAULT_PLAYER_SETTINGS.prompt,
				"{R%hh/%HH{rhp {C%mm/%MM{cmana {Y%ee{yexh {C%xp{cxp {B%XX{btnl{x > "
			);
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
			const credentials = createTestCredentials({
				username: "minimal",
				email: undefined,
			});

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
			assert.strictEqual(formatted, "0 seconds");
		});

		test("should handle exactly one hour playtime formatting", () => {
			const character = createTestCharacter();
			character.stats.playtime = 60 * 60 * 1000; // exactly 1 hour

			const formatted = character.getFormattedPlaytime();
			assert.strictEqual(formatted, "1 hours, 0 minutes, 0 seconds");
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

	suite("Channels", () => {
		test("should start with default channels", () => {
			const character = createTestCharacter();
			// Set specific test channels (defaults may change)
			character.settings.channels = new Set([
				CHANNEL.OOC,
				CHANNEL.NEWBIE,
				CHANNEL.GOSSIP,
			]);

			assert.ok(character.settings.channels);
			assert.strictEqual(character.settings.channels.size, 3);
			assert.ok(character.isInChannel(CHANNEL.OOC));
			assert.ok(character.isInChannel(CHANNEL.NEWBIE));
			assert.ok(character.isInChannel(CHANNEL.GOSSIP));
			assert.strictEqual(character.isInChannel(CHANNEL.TRADE), false);
		});

		test("should join a channel", () => {
			const character = createTestCharacter();
			character.settings.channels = new Set([
				CHANNEL.OOC,
				CHANNEL.NEWBIE,
				CHANNEL.GOSSIP,
			]);

			character.joinChannel(CHANNEL.TRADE);

			assert.ok(character.isInChannel(CHANNEL.TRADE));
			assert.strictEqual(character.settings.channels?.size, 4);
		});

		test("should leave a channel", () => {
			const character = createTestCharacter();
			character.settings.channels = new Set([
				CHANNEL.OOC,
				CHANNEL.NEWBIE,
				CHANNEL.GOSSIP,
			]);

			assert.ok(character.isInChannel(CHANNEL.OOC));
			assert.ok(character.isInChannel(CHANNEL.NEWBIE));

			character.leaveChannel(CHANNEL.OOC);

			assert.strictEqual(character.isInChannel(CHANNEL.OOC), false);
			assert.ok(character.isInChannel(CHANNEL.NEWBIE));
			assert.strictEqual(character.settings.channels?.size, 2);
		});

		test("should handle joining the same channel multiple times", () => {
			const character = createTestCharacter();
			character.settings.channels = new Set([
				CHANNEL.OOC,
				CHANNEL.NEWBIE,
				CHANNEL.GOSSIP,
			]);

			character.joinChannel(CHANNEL.OOC); // Already in OOC
			character.joinChannel(CHANNEL.OOC);
			character.joinChannel(CHANNEL.OOC);

			assert.strictEqual(character.settings.channels?.size, 3);
			assert.ok(character.isInChannel(CHANNEL.OOC));
		});

		test("should handle leaving a channel not subscribed to", () => {
			const character = createTestCharacter();
			character.settings.channels = new Set([
				CHANNEL.OOC,
				CHANNEL.NEWBIE,
				CHANNEL.GOSSIP,
			]);

			character.leaveChannel(CHANNEL.TRADE); // not in this channel

			assert.ok(character.isInChannel(CHANNEL.OOC));
			assert.strictEqual(character.settings.channels?.size, 3);
		});

		test("should handle leaving when channels is undefined", () => {
			const character = createTestCharacter();
			character.settings.channels = undefined;

			// Should not throw
			character.leaveChannel(CHANNEL.OOC);

			assert.strictEqual(character.settings.channels, undefined);
		});

		test("isInChannel should return false when channels is undefined", () => {
			const character = createTestCharacter();
			character.settings.channels = undefined;

			assert.strictEqual(character.isInChannel(CHANNEL.OOC), false);
		});

		test("should send chat to subscribed character", () => {
			const speaker = createTestCharacter({
				credentials: { username: "speaker" },
			});

			const listener = createTestCharacter({
				credentials: { username: "listener" },
			});

			// Set listener to be in OOC channel
			listener.settings.channels = new Set([CHANNEL.OOC]);

			const mockClient = createMockClient();
			listener.startSession(1, mockClient);

			listener.sendChat(speaker, "Hello world!", CHANNEL.OOC); // Check that message was sent (message + blank line + prompt = 3 sends)
			assert.ok(mockClient.sendHistory.length > 0);
			const fullMessage = mockClient.sendHistory.join("");
			assert.ok(fullMessage.includes("[OOC]"));
			assert.ok(fullMessage.includes("speaker"));
			assert.ok(fullMessage.includes("Hello world!"));
		});

		test("should not send chat to unsubscribed character", () => {
			const speaker = createTestCharacter({
				credentials: { username: "speaker" },
			});
			const listener = createTestCharacter({
				credentials: { username: "listener" },
			});

			// Set listener to have no channels
			listener.settings.channels = new Set();

			const mockClient = createMockClient();
			listener.startSession(1, mockClient);

			listener.sendChat(speaker, "Hello world!", CHANNEL.OOC);

			// No message should be sent
			assert.strictEqual(mockClient.sendHistory.length, 0);
		});

		test("should not send chat when no session active", () => {
			const speaker = createTestCharacter({
				credentials: { username: "speaker" },
			});
			const listener = createTestCharacter({
				credentials: { username: "listener" },
			});

			// Set listener to be in OOC channel
			listener.settings.channels = new Set([CHANNEL.OOC]);
			// No session started

			// Should not throw
			listener.sendChat(speaker, "Hello world!", CHANNEL.OOC);
		});

		test("should serialize and deserialize channels correctly", () => {
			const character = createTestCharacter();
			// Set specific channels directly (avoid relying on defaults)
			character.settings.channels = new Set([
				CHANNEL.OOC,
				CHANNEL.NEWBIE,
				CHANNEL.GOSSIP,
				CHANNEL.TRADE,
			]);

			const serialized = character.serialize();

			// Check that channels are serialized as array
			assert.ok(Array.isArray(serialized.settings.channels));
			assert.strictEqual(serialized.settings.channels?.length, 4);
			assert.ok(serialized.settings.channels?.includes(CHANNEL.OOC));
			assert.ok(serialized.settings.channels?.includes(CHANNEL.NEWBIE));
			assert.ok(serialized.settings.channels?.includes(CHANNEL.GOSSIP));
			assert.ok(serialized.settings.channels?.includes(CHANNEL.TRADE));

			// Deserialize and check
			const deserialized = Character.deserialize(serialized);

			assert.ok(deserialized.settings.channels instanceof Set);
			assert.strictEqual(deserialized.settings.channels.size, 4);
			assert.ok(deserialized.isInChannel(CHANNEL.OOC));
			assert.ok(deserialized.isInChannel(CHANNEL.NEWBIE));
			assert.ok(deserialized.isInChannel(CHANNEL.GOSSIP));
			assert.ok(deserialized.isInChannel(CHANNEL.TRADE));
		});
		test("should handle serialization when channels is undefined", () => {
			const character = createTestCharacter();
			character.settings.channels = undefined;

			const serialized = character.serialize();

			// Undefined channels serialize to empty array
			assert.ok(Array.isArray(serialized.settings.channels));
			assert.strictEqual(serialized.settings.channels.length, 0);

			const deserialized = Character.deserialize(serialized);

			// Deserialized channels should be an empty Set (constructor doesn't re-apply defaults if explicitly provided)
			assert.ok(deserialized.settings.channels instanceof Set);
			assert.strictEqual(deserialized.settings.channels.size, 0);
		});

		test("should handle serialization with empty channels", () => {
			const character = createTestCharacter();
			// Clear default channels
			character.settings.channels?.clear();

			const serialized = character.serialize();

			assert.ok(Array.isArray(serialized.settings.channels));
			assert.strictEqual(serialized.settings.channels?.length, 0);

			const deserialized = Character.deserialize(serialized);

			assert.ok(deserialized.settings.channels instanceof Set);
			assert.strictEqual(deserialized.settings.channels.size, 0);
		});
	});

	test("shows queued action line before prompt when actions are queued", () => {
		const character = createTestCharacter();
		const mockClient = createMockClient();
		character.startSession(1, mockClient);

		character.settings.prompt = "> ";
		const now = Date.now();
		character.actionState = {
			queue: [
				{
					input: "work",
					command: { pattern: "work" } as any,
					args: new Map(),
					cooldownMs: 1000,
					enqueuedAt: now,
				},
			],
			isProcessing: false,
			cooldownTimer: undefined,
			cooldownExpiresAt: now + 2500,
		};

		character.showPrompt();

		const history = mockClient.sendHistory.map((line) => stripColorCodes(line));
		const queueLine = history.find((line) => line.includes("[QUEUE]"));
		assert.ok(
			queueLine,
			`Expected queued action line before prompt, got history: ${history.join(
				" | "
			)}`
		);
		assert.ok(
			queueLine?.includes("work"),
			`Queued action line should include raw input, got: ${queueLine}`
		);
		const lastEntry = history[history.length - 1];
		assert.strictEqual(lastEntry, "> ");
	});
});
