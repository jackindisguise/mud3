import { describe, it, before } from "node:test";
import assert from "node:assert";
import { deserializeCharacter } from "./character.js";
import { Character, SerializedCharacter } from "../core/character.js";
import archetypePkg from "./archetype.js";
import abilitiesPkg from "./ability.js";
import { CHANNEL } from "../core/channel.js";
import { Mob } from "../core/dungeon.js";
import { createMob } from "./dungeon.js";

describe("package/character.ts deserializer", () => {
	before(async () => {
		// Ensure packages are loaded before tests
		await archetypePkg.loader();
		await abilitiesPkg.loader();
	});

	it("deserializes a basic Character", () => {
		const data: SerializedCharacter = {
			credentials: {
				characterId: 1,
				username: "testuser",
				passwordHash: "hashedpassword",
				createdAt: "2024-01-01T00:00:00.000Z",
				lastLogin: "2024-01-02T00:00:00.000Z",
				isActive: true,
				isBanned: false,
				isAdmin: false,
			},
			settings: {
				verboseMode: true,
				prompt: "> ",
				colorEnabled: true,
				autoLook: true,
				briefMode: false,
				channels: [CHANNEL.OOC, CHANNEL.GOSSIP],
				blockedUsers: ["spammer"],
			},
			stats: {
				playtime: 3600,
				deaths: 0,
				kills: 5,
			},
			mob: {
				keywords: "testuser",
				display: "Test User",
				level: 5,
				experience: 99,
				race: "human",
				job: "warrior",
				health: 100,
				mana: 50,
				exhaustion: 0,
			},
		};

		const character = deserializeCharacter(data);

		assert.ok(character instanceof Character);
		assert.strictEqual(character.credentials.username, "testuser");
		assert.strictEqual(character.credentials.characterId, 1);
		assert.ok(character.credentials.createdAt instanceof Date);
		assert.ok(character.credentials.lastLogin instanceof Date);
		assert.strictEqual(character.settings.verboseMode, true);
		assert.strictEqual(character.settings.prompt, "> ");
		assert.strictEqual(character.stats.playtime, 3600);
		assert.strictEqual(character.stats.deaths, 0);
		assert.strictEqual(character.stats.kills, 5);
		assert.ok(character.mob);
		assert.strictEqual(character.mob.keywords, "testuser");
		assert.strictEqual(character.mob.level, 5);
	});

	it("converts channels array to Set", () => {
		const data: SerializedCharacter = {
			credentials: {
				characterId: 1,
				username: "testuser",
				passwordHash: "hash",
				createdAt: "2024-01-01T00:00:00.000Z",
				lastLogin: "2024-01-01T00:00:00.000Z",
				isActive: true,
				isBanned: false,
				isAdmin: false,
			},
			settings: {
				channels: [CHANNEL.OOC, CHANNEL.GOSSIP, CHANNEL.SAY],
			},
			stats: {
				playtime: 0,
				deaths: 0,
				kills: 0,
			},
			mob: {
				keywords: "testuser",
				display: "Test User",
				level: 1,
				experience: 0,
				race: "human",
				job: "warrior",
				health: 100,
				mana: 50,
				exhaustion: 0,
			},
		};

		const character = deserializeCharacter(data);

		assert.ok(character.settings.channels instanceof Set);
		assert.strictEqual(character.settings.channels.size, 3);
		assert.ok(character.settings.channels.has(CHANNEL.OOC));
		assert.ok(character.settings.channels.has(CHANNEL.GOSSIP));
		assert.ok(character.settings.channels.has(CHANNEL.SAY));
	});

	it("converts blockedUsers array to Set", () => {
		const data: SerializedCharacter = {
			credentials: {
				characterId: 1,
				username: "testuser",
				passwordHash: "hash",
				createdAt: "2024-01-01T00:00:00.000Z",
				lastLogin: "2024-01-01T00:00:00.000Z",
				isActive: true,
				isBanned: false,
				isAdmin: false,
			},
			settings: {
				blockedUsers: ["user1", "user2"],
			},
			stats: {
				playtime: 0,
				deaths: 0,
				kills: 0,
			},
			mob: {
				keywords: "testuser",
				display: "Test User",
				level: 1,
				experience: 0,
				race: "human",
				job: "warrior",
				health: 100,
				mana: 50,
				exhaustion: 0,
			},
		};

		const character = deserializeCharacter(data);

		assert.ok(character.settings.blockedUsers instanceof Set);
		assert.strictEqual(character.settings.blockedUsers!.size, 2);
		assert.ok(character.settings.blockedUsers!.has("user1"));
		assert.ok(character.settings.blockedUsers!.has("user2"));
	});

	it("handles missing characterId with default value", () => {
		const data: SerializedCharacter = {
			credentials: {
				username: "testuser",
				passwordHash: "hash",
				createdAt: "2024-01-01T00:00:00.000Z",
				lastLogin: "2024-01-01T00:00:00.000Z",
				isActive: true,
				isBanned: false,
				isAdmin: false,
			} as any,
			settings: {},
			stats: {
				playtime: 0,
				deaths: 0,
				kills: 0,
			},
			mob: {
				keywords: "testuser",
				display: "Test User",
				level: 1,
				experience: 0,
				race: "human",
				job: "warrior",
				health: 100,
				mana: 50,
				exhaustion: 0,
			},
		};

		const character = deserializeCharacter(data);

		// Should assign Number.MAX_SAFE_INTEGER as fallback
		assert.strictEqual(
			character.credentials.characterId,
			Number.MAX_SAFE_INTEGER
		);
	});

	it("round-trips a Character", () => {
		const mob = createMob();
		const original = new Character({
			credentials: {
				characterId: 1,
				username: "testuser",
				passwordHash: "hash",
				createdAt: new Date(),
				lastLogin: new Date(),
				isActive: true,
				isBanned: false,
				isAdmin: false,
			},
			settings: {
				verboseMode: true,
				prompt: "> ",
				colorEnabled: true,
			},
			stats: {
				playtime: 1000,
				deaths: 2,
				kills: 10,
			},
			mob,
		});

		const serialized = original.serialize();
		const deserialized = deserializeCharacter(serialized);

		assert.strictEqual(
			deserialized.credentials.username,
			original.credentials.username
		);
		assert.strictEqual(
			deserialized.credentials.characterId,
			original.credentials.characterId
		);
		assert.strictEqual(
			deserialized.settings.verboseMode,
			original.settings.verboseMode
		);
		assert.strictEqual(deserialized.settings.prompt, original.settings.prompt);
		assert.strictEqual(deserialized.stats.playtime, original.stats.playtime);
		assert.strictEqual(deserialized.stats.deaths, original.stats.deaths);
		assert.strictEqual(deserialized.stats.kills, original.stats.kills);
		assert.ok(deserialized.mob);
		assert.strictEqual(deserialized.mob.keywords, original.mob!.keywords);
	});
});
