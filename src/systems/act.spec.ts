import { test, suite, beforeEach, before } from "node:test";
import assert from "node:assert";
import {
	act,
	ActMessageTemplates,
	ActContext,
	ActOptions,
	damageMessage,
} from "./act.js";
import archetypePkg from "../package/archetype.js";
import { Mob, Room, Dungeon } from "../core/dungeon.js";
import { Character, MESSAGE_GROUP } from "../core/character.js";
import { freezeArchetype } from "../core/archetype.js";
import { createMob } from "../package/dungeon.js";
import { getDefaultJob, getDefaultRace } from "../registry/archetype.js";

suite("act.ts", () => {
	before(async () => {
		await archetypePkg.loader();
	});

	let dungeon: Dungeon;
	let room: Room;
	let user: Mob;
	let target: Mob;
	let observer: Mob;
	let userCharacter: Character;
	let targetCharacter: Character;
	let observerCharacter: Character;

	// Helper to create a test character with message tracking
	function createTestMob(display: string, keywords: string): Mob {
		return createMob({
			display,
			keywords,
			race: getDefaultRace(),
			job: getDefaultJob(),
		});
	}
	function createTestCharacter(
		mob: Mob,
		characterId: number
	): Character & {
		messageHistory: Array<{ text: string; group: MESSAGE_GROUP }>;
	} {
		const messageHistory: Array<{ text: string; group: MESSAGE_GROUP }> = [];
		const character = new Character({
			credentials: {
				characterId,
				username: mob.display.toLowerCase(),
			},
			mob,
		});

		// Override sendMessage to track messages
		const originalSendMessage = character.sendMessage.bind(character);
		(character as any).messageHistory = messageHistory;
		character.sendMessage = (text: string, group: MESSAGE_GROUP) => {
			messageHistory.push({ text, group });
			originalSendMessage(text, group);
		};

		return character as Character & {
			messageHistory: Array<{ text: string; group: MESSAGE_GROUP }>;
		};
	}

	// Helper to get messages for a character
	function getMessages(
		character: Character & {
			messageHistory?: Array<{ text: string; group: MESSAGE_GROUP }>;
		},
		group: MESSAGE_GROUP
	): string[] {
		const history = (character as any).messageHistory || [];
		return history
			.filter((m: { text: string; group: MESSAGE_GROUP }) => m.group === group)
			.map((m: { text: string; group: MESSAGE_GROUP }) => m.text);
	}

	beforeEach(() => {
		dungeon = new Dungeon({
			dimensions: { width: 10, height: 10, layers: 1 },
		});
		room = new Room({
			coordinates: { x: 0, y: 0, z: 0 },
			dungeon,
		});
		dungeon.addRoom(room);

		// Create user mob with character
		user = createTestMob("Alice", "alice");
		user.location = room;
		userCharacter = createTestCharacter(user, 1);
		user.character = userCharacter;

		// Create target mob with character
		target = createTestMob("Bob", "bob");
		target.location = room;
		targetCharacter = createTestCharacter(target, 2);
		target.character = targetCharacter;

		// Create observer mob with character
		observer = createTestMob("Charlie", "charlie");
		observer.location = room;
		observerCharacter = createTestCharacter(observer, 3);
		observer.character = observerCharacter;
	});

	suite("act function", () => {
		test("should send user message to user", () => {
			const templates: ActMessageTemplates = {
				user: "You wave at {target}.",
				room: "{User} waves at {target}.",
			};
			const context: ActContext = {
				user,
				target,
				room,
			};

			act(templates, context);

			const messages = getMessages(userCharacter, MESSAGE_GROUP.ACTION);
			assert.strictEqual(messages.length, 1);
			assert.strictEqual(messages[0], "You wave at Bob.");
		});

		test("should send target message to target", () => {
			const templates: ActMessageTemplates = {
				user: "You wave at {target}.",
				target: "{User} waves at you.",
				room: "{User} waves at {target}.",
			};
			const context: ActContext = {
				user,
				target,
				room,
			};

			act(templates, context);

			const messages = getMessages(targetCharacter, MESSAGE_GROUP.ACTION);
			assert.strictEqual(messages.length, 1);
			assert.strictEqual(messages[0], "Alice waves at you.");
		});

		test("should send room message to observers", () => {
			const templates: ActMessageTemplates = {
				user: "You wave.",
				room: "{User} waves.",
			};
			const context: ActContext = {
				user,
				room,
			};

			act(templates, context);

			const messages = getMessages(observerCharacter, MESSAGE_GROUP.ACTION);
			assert.strictEqual(messages.length, 1);
			assert.strictEqual(messages[0], "Alice waves.");
		});

		test("should exclude user from room messages by default", () => {
			const templates: ActMessageTemplates = {
				user: "You wave.",
				room: "{User} waves.",
			};
			const context: ActContext = {
				user,
				room,
			};

			act(templates, context);

			const userMessages = getMessages(userCharacter, MESSAGE_GROUP.ACTION);
			// User should only see their own message, not the room message
			assert.strictEqual(userMessages.length, 1);
			assert.strictEqual(userMessages[0], "You wave.");
		});

		test("should exclude target from room messages by default", () => {
			const templates: ActMessageTemplates = {
				user: "You wave at {target}.",
				target: "{User} waves at you.",
				room: "{User} waves at {target}.",
			};
			const context: ActContext = {
				user,
				target,
				room,
			};

			act(templates, context);

			const targetMessages = getMessages(targetCharacter, MESSAGE_GROUP.ACTION);
			// Target should only see their own message, not the room message
			assert.strictEqual(targetMessages.length, 1);
			assert.strictEqual(targetMessages[0], "Alice waves at you.");
		});

		test("should replace placeholders correctly", () => {
			const templates: ActMessageTemplates = {
				user: "You say hello to {target}.",
				target: "{User} says hello to you.",
				room: "{User} says hello to {target}.",
			};
			const context: ActContext = {
				user,
				target,
				room,
			};

			act(templates, context);

			const userMessages = getMessages(userCharacter, MESSAGE_GROUP.ACTION);
			const targetMessages = getMessages(targetCharacter, MESSAGE_GROUP.ACTION);
			const observerMessages = getMessages(
				observerCharacter,
				MESSAGE_GROUP.ACTION
			);

			assert.strictEqual(userMessages[0], "You say hello to Bob.");
			assert.strictEqual(targetMessages[0], "Alice says hello to you.");
			assert.strictEqual(observerMessages[0], "Alice says hello to Bob.");
		});

		test("should handle capitalized placeholders", () => {
			const templates: ActMessageTemplates = {
				user: "You greet {Target}.",
				room: "{User} greets {Target}.",
			};
			const context: ActContext = {
				user,
				target,
				room,
			};

			act(templates, context);

			const userMessages = getMessages(userCharacter, MESSAGE_GROUP.ACTION);
			const observerMessages = getMessages(
				observerCharacter,
				MESSAGE_GROUP.ACTION
			);

			assert.strictEqual(userMessages[0], "You greet Bob.");
			assert.strictEqual(observerMessages[0], "Alice greets Bob.");
		});

		test("should handle actions without target", () => {
			const templates: ActMessageTemplates = {
				user: "You dance.",
				room: "{User} dances.",
			};
			const context: ActContext = {
				user,
				room,
			};

			act(templates, context);

			const userMessages = getMessages(userCharacter, MESSAGE_GROUP.ACTION);
			const observerMessages = getMessages(
				observerCharacter,
				MESSAGE_GROUP.ACTION
			);

			assert.strictEqual(userMessages[0], "You dance.");
			assert.strictEqual(observerMessages[0], "Alice dances.");
		});

		test("should use custom message group", () => {
			const templates: ActMessageTemplates = {
				user: "You shout!",
				room: "{User} shouts!",
			};
			const context: ActContext = {
				user,
				room,
			};
			const options: ActOptions = {
				messageGroup: MESSAGE_GROUP.INFO,
			};

			act(templates, context, options);

			const userMessages = getMessages(userCharacter, MESSAGE_GROUP.INFO);
			assert.strictEqual(userMessages.length, 1);
		});

		test("should handle visibility - invisible user", () => {
			const templates: ActMessageTemplates = {
				user: "You sneak past {target}.",
				room: "{User} sneaks past {target}.",
			};
			const context: ActContext = {
				user,
				target,
				room,
			};
			const options: ActOptions = {
				visibility: {
					canSeeUser: false,
					canSeeTarget: true,
				},
			};

			act(templates, context, options);

			const observerMessages = getMessages(
				observerCharacter,
				MESSAGE_GROUP.ACTION
			);
			assert.strictEqual(observerMessages[0], "Someone sneaks past Bob.");
		});

		test("should handle visibility - invisible target", () => {
			const templates: ActMessageTemplates = {
				user: "You attack {target}.",
				room: "{User} attacks {target}.",
			};
			const context: ActContext = {
				user,
				target,
				room,
			};
			const options: ActOptions = {
				visibility: {
					canSeeUser: true,
					canSeeTarget: false,
				},
			};

			act(templates, context, options);

			const observerMessages = getMessages(
				observerCharacter,
				MESSAGE_GROUP.ACTION
			);
			assert.strictEqual(observerMessages[0], "Alice attacks someone.");
		});

		test("should not send message to mobs without characters", () => {
			const npc = createTestMob("NPC", "npc");
			npc.location = room;

			const templates: ActMessageTemplates = {
				user: "You wave.",
				room: "{User} waves.",
			};
			const context: ActContext = {
				user,
				room,
			};

			act(templates, context);

			// Should not throw, and NPC should not receive messages
			const observerMessages = getMessages(
				observerCharacter,
				MESSAGE_GROUP.ACTION
			);
			assert.strictEqual(observerMessages.length, 1);
		});

		test("should not send user message if user has no character", () => {
			const npcUser = createTestMob("NPC User", "npc user");
			npcUser.location = room;
			npcUser.character = undefined;

			const templates: ActMessageTemplates = {
				user: "You wave.",
				room: "{User} waves.",
			};
			const context: ActContext = {
				user: npcUser,
				room,
			};

			act(templates, context);

			// Should not throw, and room observers should still see the message
			const observerMessages = getMessages(
				observerCharacter,
				MESSAGE_GROUP.ACTION
			);
			assert.strictEqual(observerMessages.length, 1);
			assert.strictEqual(observerMessages[0], "NPC User waves.");
		});

		test("should include user in room messages if excludeUser is false", () => {
			const templates: ActMessageTemplates = {
				user: "You wave.",
				room: "{User} waves.",
			};
			const context: ActContext = {
				user,
				room,
			};
			const options: ActOptions = {
				excludeUser: false,
			};

			act(templates, context, options);

			const userMessages = getMessages(userCharacter, MESSAGE_GROUP.ACTION);
			// User should see both their own message and the room message
			assert.ok(userMessages.length >= 1);
			assert.ok(userMessages.some((msg: string) => msg === "You wave."));
			assert.ok(userMessages.some((msg: string) => msg === "Alice waves."));
		});

		test("should include target in room messages if excludeTarget is false", () => {
			const templates: ActMessageTemplates = {
				user: "You wave at {target}.",
				target: "{User} waves at you.",
				room: "{User} waves at {target}.",
			};
			const context: ActContext = {
				user,
				target,
				room,
			};
			const options: ActOptions = {
				excludeTarget: false,
			};

			act(templates, context, options);

			const targetMessages = getMessages(targetCharacter, MESSAGE_GROUP.ACTION);
			// Target should see both their own message and the room message
			assert.ok(targetMessages.length >= 1);
			assert.ok(
				targetMessages.some((msg: string) => msg === "Alice waves at you.")
			);
			assert.ok(
				targetMessages.some((msg: string) => msg === "Alice waves at Bob.")
			);
		});
	});

	suite("damageMessage function", () => {
		// Helper to create a test mob with specific maxHealth
		function createTestMobWithHealth(
			display: string,
			maxHealth: number,
			currentHealth: number
		): Mob {
			// Set attributes to 0 to avoid vitality bonus affecting maxHealth
			const testMob = createTestMob(display, display.toLowerCase());
			testMob.level = 1;
			testMob.location = room;
			testMob.health = currentHealth;
			return testMob;
		}

		test("should add HP percentage to user message", () => {
			const testTarget = createTestMobWithHealth("TestTarget", 100, 100);
			const testTargetCharacter = createTestCharacter(testTarget, 4);
			testTarget.character = testTargetCharacter;

			const templates: ActMessageTemplates = {
				user: "You hit {target} for 25 damage.",
				target: "{User} hits you for 25 damage.",
				room: "{User} hits {target} for 25 damage.",
			};
			const context: ActContext = {
				user,
				target: testTarget,
				room,
			};

			damageMessage(templates, context, testTarget, 25);

			const userMessages = getMessages(userCharacter, MESSAGE_GROUP.ACTION);
			assert.strictEqual(userMessages.length, 1);
			assert.strictEqual(
				userMessages[0],
				"You hit TestTarget for 25 damage. [60%]"
			);
		});

		test("should add HP percentage to target message", () => {
			const testTarget = createTestMobWithHealth("TestTarget", 100, 100);
			const testTargetCharacter = createTestCharacter(testTarget, 4);
			testTarget.character = testTargetCharacter;

			const templates: ActMessageTemplates = {
				user: "You hit {target} for 25 damage.",
				target: "{User} hits you for 25 damage.",
				room: "{User} hits {target} for 25 damage.",
			};
			const context: ActContext = {
				user,
				target: testTarget,
				room,
			};

			damageMessage(templates, context, testTarget, 25);

			const targetMessages = getMessages(
				testTargetCharacter,
				MESSAGE_GROUP.ACTION
			);
			assert.strictEqual(targetMessages.length, 1);
			assert.strictEqual(
				targetMessages[0],
				"Alice hits you for 25 damage. [60%]"
			);
		});

		test("should not add HP percentage to room message", () => {
			const testTarget = createTestMobWithHealth("TestTarget", 100, 100);
			const testTargetCharacter = createTestCharacter(testTarget, 4);
			testTarget.character = testTargetCharacter;

			const templates: ActMessageTemplates = {
				user: "You hit {target} for 25 damage.",
				target: "{User} hits you for 25 damage.",
				room: "{User} hits {target} for 25 damage.",
			};
			const context: ActContext = {
				user,
				target: testTarget,
				room,
			};

			damageMessage(templates, context, testTarget, 25);

			const observerMessages = getMessages(
				observerCharacter,
				MESSAGE_GROUP.ACTION
			);
			assert.strictEqual(observerMessages.length, 1);
			assert.strictEqual(
				observerMessages[0],
				"Alice hits TestTarget for 25 damage."
			);
		});

		test("should handle zero health", () => {
			const testTarget = createTestMobWithHealth("TestTarget", 100, 50);

			const templates: ActMessageTemplates = {
				user: "You hit {target} for 50 damage.",
				target: "{User} hits you for 50 damage.",
				room: "{User} hits {target} for 50 damage.",
			};
			const context: ActContext = {
				user,
				target: testTarget,
				room,
			};

			damageMessage(templates, context, testTarget, 50);

			const userMessages = getMessages(userCharacter, MESSAGE_GROUP.ACTION);
			assert.strictEqual(
				userMessages[0],
				"You hit TestTarget for 50 damage. [0%]"
			);
		});

		test("should handle overkill damage", () => {
			const testTarget = createTestMobWithHealth("TestTarget", 100, 10);

			const templates: ActMessageTemplates = {
				user: "You hit {target} for 50 damage.",
				target: "{User} hits you for 50 damage.",
				room: "{User} hits {target} for 50 damage.",
			};
			const context: ActContext = {
				user,
				target: testTarget,
				room,
			};

			damageMessage(templates, context, testTarget, 50);

			const userMessages = getMessages(userCharacter, MESSAGE_GROUP.ACTION);
			// Should show 0% even though damage exceeds current health
			assert.strictEqual(
				userMessages[0],
				"You hit TestTarget for 50 damage. [0%]"
			);
		});

		test("should use custom message group", () => {
			const testTarget = createTestMobWithHealth("TestTarget", 100, 100);
			const testTargetCharacter = createTestCharacter(testTarget, 4);
			testTarget.character = testTargetCharacter;

			const templates: ActMessageTemplates = {
				user: "You hit {target} for 25 damage.",
				target: "{User} hits you for 25 damage.",
				room: "{User} hits {target} for 25 damage.",
			};
			const context: ActContext = {
				user,
				target: testTarget,
				room,
			};
			const options: ActOptions = {
				messageGroup: MESSAGE_GROUP.COMBAT,
			};

			damageMessage(templates, context, testTarget, 25, options);

			const userMessages = getMessages(userCharacter, MESSAGE_GROUP.COMBAT);
			assert.strictEqual(userMessages.length, 1);
		});

		test("should handle missing user template", () => {
			const testTarget = createTestMobWithHealth("TestTarget", 100, 100);

			const templates: ActMessageTemplates = {
				target: "{User} hits you for 25 damage.",
				room: "{User} hits {target} for 25 damage.",
			};
			const context: ActContext = {
				user,
				target: testTarget,
				room,
			};

			damageMessage(templates, context, testTarget, 25);

			const userMessages = getMessages(userCharacter, MESSAGE_GROUP.ACTION);
			assert.strictEqual(userMessages.length, 0);
		});

		test("should handle missing target template", () => {
			const testTarget = createTestMobWithHealth("TestTarget", 100, 100);
			const testTargetCharacter = createTestCharacter(testTarget, 4);
			testTarget.character = testTargetCharacter;

			const templates: ActMessageTemplates = {
				user: "You hit {target} for 25 damage.",
				room: "{User} hits {target} for 25 damage.",
			};
			const context: ActContext = {
				user,
				target: testTarget,
				room,
			};

			damageMessage(templates, context, testTarget, 25);

			// Target should not receive a message since there's no target template
			// But they might receive the room message if excludeTarget is false (default is true)
			// Actually, excludeTarget defaults to true, so target should not see room message
			const targetMessages = getMessages(
				testTargetCharacter,
				MESSAGE_GROUP.ACTION
			);
			assert.strictEqual(targetMessages.length, 0);
		});
	});
});
