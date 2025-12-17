import { test, suite, beforeEach, skip, afterEach } from "node:test";
import assert from "node:assert";
import { greaterThanOrEqual } from "../utils/assert.js";
import { Dungeon, Mob, Room, BEHAVIOR, ThreatEntry } from "../core/dungeon.js";
import { Character } from "../core/character.js";
import { processThreatSwitching } from "./combat.js";
import { freezeArchetype, Job, Race } from "../core/archetype.js";
import { createMob } from "../package/dungeon.js";

const testRace: Race = {
	id: "test_race",
	name: "Test Race",
	startingAttributes: { strength: 10, agility: 10, intelligence: 10 },
	attributeGrowthPerLevel: { strength: 0, agility: 0, intelligence: 0 },
	startingResourceCaps: { maxHealth: 100000, maxMana: 50 },
	resourceGrowthPerLevel: { maxHealth: 0, maxMana: 0 },
	abilities: [],
	passives: [],
	growthModifier: { base: 1.0 },
};

const testJob: Job = {
	id: "test_job",
	name: "Test Job",
	startingAttributes: { strength: 10, agility: 10, intelligence: 10 },
	attributeGrowthPerLevel: { strength: 0, agility: 0, intelligence: 0 },
	startingResourceCaps: { maxHealth: 100000, maxMana: 50 },
	resourceGrowthPerLevel: { maxHealth: 0, maxMana: 0 },
	abilities: [],
	passives: [],
	growthModifier: { base: 1.0 },
};

suite("threat.ts", () => {
	let dungeon: Dungeon;
	let room1: Room;
	let room2: Room;
	let npc: Mob;
	let npc2: Mob;
	let player1: Mob;
	let player2: Mob;

	function createTestCharacter(mob: Mob, id: number): Character {
		const character = new Character({
			credentials: {
				characterId: id,
				username: `player${id}`,
			},
			mob,
		});
		return character;
	}

	function createNPC(room: Room): Mob {
		const npc = new Mob({
			display: "NPC",
			race: testRace,
			job: testJob,
			level: 1000,
		});
		npc.location = room;
		room.add(npc);
		return npc;
	}

	function createPlayerMob(id: number, room: Room): Mob {
		const mob = new Mob({
			display: `Player${id}`,
			race: testRace,
			job: testJob,
			level: 1000,
		});
		const character = createTestCharacter(mob, id);
		mob.character = character;
		room.add(mob);
		return mob;
	}

	beforeEach(() => {
		dungeon = new Dungeon({
			dimensions: { width: 10, height: 10, layers: 1 },
		});
		room1 = dungeon.createRoom({
			coordinates: { x: 0, y: 0, z: 0 },
			dungeon,
		})!;
		room2 = dungeon.createRoom({
			coordinates: { x: 1, y: 0, z: 0 },
			dungeon,
		})!;
		dungeon.add(room1);
		dungeon.add(room2);
		npc = createNPC(room1);
		npc2 = createNPC(room1);
		player1 = createPlayerMob(1, room1);
		player2 = createPlayerMob(2, room1);
	});

	afterEach(() => {
		npc.combatTarget = undefined;
		npc2.combatTarget = undefined;
		npc.clearThreatTable();
		npc2.clearThreatTable();
		player1.combatTarget = undefined;
		player2.combatTarget = undefined;
		player1.clearThreatTable();
		player2.clearThreatTable();
	});

	suite("Threat Table Initialization", () => {
		test("should initialize threat table when threat is added", () => {
			assert.strictEqual(
				npc.threatTable,
				undefined,
				"Threat table should not exist initially"
			);

			npc.addThreat(player1, 10);

			assert.ok(
				npc.threatTable !== undefined,
				"Threat table should be initialized after adding threat"
			);
			const table = npc.threatTable as ReadonlyMap<Mob, ThreatEntry>;
			assert.strictEqual(table.size, 1, "Threat table should have one entry");
		});

		test("should not have threat table for player-controlled mobs", () => {
			assert.strictEqual(
				player1.threatTable,
				undefined,
				"Player-controlled mobs should not have threat table"
			);
		});

		test("should not add threat for player-controlled mobs", () => {
			const testCharacter = createTestCharacter(npc, 999);
			npc.character = testCharacter;

			npc.addThreat(player1, 100);

			assert.strictEqual(
				npc.threatTable,
				undefined,
				"Player-controlled mobs should not have threat table"
			);
		});
	});

	suite("Adding and Getting Threat", () => {
		test("should add threat when damage is dealt", () => {
			npc.damage(player1, 25);

			const threat = npc.getThreat(player1);
			assert.strictEqual(threat, 25, "Threat should equal damage dealt");
		});

		test("should accumulate threat from multiple attacks", () => {
			npc.damage(player1, 25);
			npc.damage(player1, 30);
			npc.damage(player1, 15);

			const threat = npc.getThreat(player1);
			assert.strictEqual(threat, 70, "Threat should accumulate");
		});

		test("should set shouldExpire flag to false when threat is added", () => {
			npc.damage(player1, 25);

			const threatEntry = npc.threatTable?.get(player1);
			assert.ok(threatEntry !== undefined, "Threat entry should exist");
			assert.strictEqual(
				threatEntry?.shouldExpire,
				false,
				"shouldExpire should be false when threat is added"
			);
		});

		test("should return 0 threat for non-existent attacker", () => {
			const threat = npc.getThreat(player1);
			assert.strictEqual(threat, 0, "Should return 0 for non-existent threat");
		});

		test("should return 0 threat when threat table doesn't exist", () => {
			const threat = player1.getThreat(npc);
			assert.strictEqual(
				threat,
				0,
				"Should return 0 when threat table doesn't exist"
			);
		});

		test("should handle negative threat amount", () => {
			npc.addThreat(player1, 100);
			npc.addThreat(player1, -50);

			const threat = npc.getThreat(player1);
			assert.strictEqual(threat, 50, "Negative threat should subtract");
		});

		test("should accumulate threat correctly with multiple addThreat calls", () => {
			npc.addThreat(player1, 10);
			npc.addThreat(player1, 20);
			npc.addThreat(player1, 30);

			const threat = npc.getThreat(player1);
			assert.strictEqual(threat, 60, "Threat should accumulate");
		});
	});

	suite("Highest Threat Target", () => {
		test("should get highest threat target", () => {
			npc.addThreat(player1, 50);
			npc.addThreat(player2, 100);

			const highestThreat = npc.getHighestThreatTarget();
			assert.ok(
				highestThreat === player2,
				"Should return mob with highest threat"
			);
		});

		test("should return undefined if no threat exists", () => {
			const result = npc.getHighestThreatTarget();
			assert.strictEqual(
				result,
				undefined,
				"Should return undefined when no threat"
			);
		});

		test("should select one mob when multiple have equal highest threat", () => {
			npc.addThreat(player1, 100);
			npc.addThreat(player2, 100);

			const highestThreat = npc.getHighestThreatTarget();
			assert.ok(
				highestThreat === player1 || highestThreat === player2,
				"Should return one of the mobs with equal threat"
			);
		});
	});

	suite("Threat Switching", () => {
		test("should select highest threat target when no current target", () => {
			npc.damage(player1, 50);
			npc.damage(player2, 100);

			processThreatSwitching(npc);

			assert.equal(
				npc.combatTarget?.display,
				player2.display,
				"Should target highest threat"
			);
			assert.ok(npc.isInCombat(), "Should be in combat");
		});

		test("should not switch targets if new target has less than 10% more threat", () => {
			npc.damage(player1, 100);
			processThreatSwitching(npc);
			assert.ok(npc.combatTarget === player1, "Should target player1");

			// Add threat to player2, but only 5% more (105 vs 100)
			npc.damage(player2, 105);
			processThreatSwitching(npc);

			assert.ok(
				npc.combatTarget === player1,
				"Should not switch - player2 doesn't have 10% more threat"
			);
		});

		test("should switch targets if new target has 10% more threat", () => {
			npc.damage(player1, 100);
			processThreatSwitching(npc);
			assert.ok(npc.combatTarget === player1, "Should target player1");

			// Add threat to player2 with 10% more (111 vs 100)
			npc.damage(player2, 111);
			processThreatSwitching(npc);

			assert.ok(
				npc.combatTarget === player2,
				"Should switch to player2 - has 10% more threat"
			);
		});

		test("should not switch to target in different room", () => {
			npc.damage(player1, 50);
			assert.ok(npc.combatTarget === player1, "Should target player1");

			// Move player2 to a different room
			player2.move(room2);
			npc.damage(player2, 200); // Much higher threat
			processThreatSwitching(npc);

			assert.ok(
				npc.combatTarget === player1,
				"Should not switch to player2 - they're in different room"
			);
		});

		test("should clear target if current target leaves room", () => {
			npc.damage(player1, 100);
			processThreatSwitching(npc);
			assert.ok(npc.combatTarget === player1, "Should target player1");

			room2.add(player1);
			processThreatSwitching(npc);

			assert.ok(
				npc.combatTarget === undefined,
				"Should clear target when target leaves room"
			);
		});

		test("should find new target if current target leaves room", () => {
			npc.damage(player1, 100);
			npc.damage(player2, 50);
			processThreatSwitching(npc);
			assert.ok(npc.combatTarget === player1, "Should target player1");

			room2.add(player1);

			processThreatSwitching(npc);

			assert.ok(
				npc.combatTarget === player2,
				"Should switch to player2 when player1 leaves"
			);
		});

		test("should not switch when current target is highest threat", () => {
			npc.damage(player1, 100);
			npc.damage(player2, 50);
			processThreatSwitching(npc);
			assert.ok(npc.combatTarget === player1, "Should target player1");

			npc.damage(player1, 50);
			processThreatSwitching(npc);

			assert.ok(
				npc.combatTarget === player1,
				"Should not switch when current target is highest"
			);
		});

		test("should not switch when highest threat is equal to current threat", () => {
			npc.damage(player1, 100);
			processThreatSwitching(npc);
			assert.ok(npc.combatTarget === player1, "Should target player1");

			npc.damage(player2, 100);
			processThreatSwitching(npc);

			assert.ok(
				npc.combatTarget === player1,
				"Should not switch when threat is equal"
			);
		});

		test("should handle threat switching when npc has no location", () => {
			npc.damage(player1, 100);
			npc.location = undefined;

			processThreatSwitching(npc);

			assert.ok(
				npc.combatTarget === undefined,
				"Should not have target without location"
			);
		});
	});

	suite("Aggressive Behavior Threat Generation", () => {
		test.skip("should generate some threat when character enters room with aggressive mob", () => {
			const npc3 = createMob({
				behaviors: {
					[BEHAVIOR.AGGRESSIVE]: true,
				},
				race: testRace,
				job: testJob,
			});
			room1.add(npc3);
			player1.move(room2);
			player1.move(room1);
			assert.strictEqual(
				npc.combatTarget?.display,
				player1.display,
				"Should be in combat"
			);

			const threat = npc.getThreat(player1);
			assert.notStrictEqual(threat, 0, "Should generate some threat");
		});

		test.skip("should generate threat for each character when aggressive mob enters room", () => {
			player1.move(room2);
			player2.move(room2);

			npc.setBehavior(BEHAVIOR.AGGRESSIVE, true);
			npc.move(room2);

			const threat1 = npc.getThreat(player1);
			const threat2 = npc.getThreat(player2);
			assert.notStrictEqual(
				threat1,
				0,
				"Should generate some threat for player1"
			);
			assert.notStrictEqual(
				threat2,
				0,
				"Should generate some threat for player2"
			);
			assert.ok(
				npc.combatTarget === player1,
				"Should target one of the players"
			);
		});

		test.skip("should not generate threat for non-character mobs", () => {
			npc2.location = room2;
			npc.setBehavior(BEHAVIOR.AGGRESSIVE, true);
			npc2.move(room1);
			const threat = npc.getThreat(npc2);
			assert.strictEqual(threat, 0, "Should not generate threat for NPC");
		});
	});

	suite("Threat Expiration", () => {
		test("should start expiration timer when threat is added", () => {
			const timerBefore = (npc as any)._threatExpirationTimer;
			assert.strictEqual(
				timerBefore,
				undefined,
				"Timer should not exist before threat"
			);

			npc.damage(player1, 25);

			const timerAfter = (npc as any)._threatExpirationTimer;
			assert.ok(
				timerAfter !== undefined,
				"Timer should be started after threat is added"
			);
		});

		test("should stop expiration timer when threat table is empty", () => {
			npc.damage(player1, 25);
			const timerStarted = (npc as any)._threatExpirationTimer;
			assert.ok(timerStarted !== undefined, "Timer should be started");

			npc.clearThreatTable();

			const timerAfter = (npc as any)._threatExpirationTimer;
			assert.strictEqual(
				timerAfter,
				undefined,
				"Timer should be stopped when table is empty"
			);
		});

		test("should set shouldExpire flag to true on first expiration cycle", () => {
			// Move players to different room so threat can expire
			player1.move(room2);
			player2.move(room2);
			npc.damage(player1, 200);
			npc.damage(player2, 500);
			const threatEntry = npc.threatTable!.get(player1);
			assert.strictEqual(
				threatEntry?.shouldExpire,
				false,
				"shouldExpire should be false initially"
			);

			(npc as any)._processThreatExpiration();

			const threatEntryAfter = npc.threatTable!.get(player1);
			assert.strictEqual(
				threatEntryAfter?.shouldExpire,
				true,
				"shouldExpire should be true after first cycle"
			);
			assert.strictEqual(
				threatEntryAfter?.value,
				200,
				"Threat value should not change on first cycle"
			);
		});

		test("should reduce threat by 33% on second expiration cycle", () => {
			// Move players to different room so threat can expire
			player1.move(room2);
			player2.move(room2);
			npc.damage(player1, 600);
			npc.damage(player2, 500);
			(npc as any)._processThreatExpiration();
			(npc as any)._processThreatExpiration();

			const threatEntry = npc.threatTable!.get(player2);
			const expectedValue = Math.floor(500 * 0.67); // 333
			assert.strictEqual(
				threatEntry?.value,
				expectedValue,
				"Threat should be reduced by 33%"
			);
		});

		test("should remove threat entry when reduced below 100", () => {
			// Move players to different room so threat can expire
			player1.move(room2);
			player2.move(room2);
			npc.damage(player1, 500);
			npc.damage(player2, 335);
			(npc as any)._processThreatExpiration();
			(npc as any)._processThreatExpiration();
			(npc as any)._processThreatExpiration();
			(npc as any)._processThreatExpiration();

			let threatEntry = npc.threatTable?.get(player2);
			assert.ok(threatEntry !== undefined, "Threat should still exist at 100");
			assert.equal(threatEntry?.value, 100);

			(npc as any)._processThreatExpiration();

			threatEntry = npc.threatTable?.get(player2);
			assert.strictEqual(
				threatEntry,
				undefined,
				"Threat should be removed when below 100"
			);
		});

		test("should not expire threat for current combat target", () => {
			// Move player2 to different room so threat can expire for them
			player2.move(room2);
			npc.damage(player1, 200);
			npc.damage(player2, 150);
			processThreatSwitching(npc);
			assert.ok(npc.combatTarget === player1, "Should target player1");

			(npc as any)._processThreatExpiration();

			const threatEntry1 = npc.threatTable?.get(player1);
			const threatEntry2 = npc.threatTable?.get(player2);

			assert.strictEqual(
				threatEntry1?.shouldExpire,
				false,
				"Current target should not be marked for expiration"
			);
			assert.strictEqual(
				threatEntry2?.shouldExpire,
				true,
				"Non-target should be marked for expiration"
			);

			(npc as any)._processThreatExpiration();

			const threatEntry1After = npc.threatTable?.get(player1);
			const threatEntry2After = npc.threatTable?.get(player2);

			assert.strictEqual(
				threatEntry1After?.value,
				200,
				"Current target threat should not be reduced"
			);
			const expectedValue2 = Math.floor(150 * 0.67); // 100
			assert.strictEqual(
				threatEntry2After?.value,
				expectedValue2,
				"Non-target threat should be reduced"
			);
		});

		test("should not expire threat for mobs in the same room", () => {
			// Create a third player in the same room
			const player3 = createPlayerMob(3, room1);
			// Move player2 to a different room so we can test expiration for them
			player2.move(room2);
			npc.damage(player1, 200); // In same room
			npc.damage(player2, 150); // In different room
			npc.damage(player3, 300); // In same room
			// Don't set combat target
			npc.combatTarget = undefined;

			// First expiration cycle
			(npc as any)._processThreatExpiration();

			const threatEntry1 = npc.threatTable?.get(player1);
			const threatEntry2 = npc.threatTable?.get(player2);
			const threatEntry3 = npc.threatTable?.get(player3);

			// Player1 and player3 are in same room - should not be marked for expiration
			// Player2 is in different room - should be marked for expiration
			assert.strictEqual(
				threatEntry1?.shouldExpire,
				false,
				"Player1 in same room should not be marked for expiration"
			);
			assert.strictEqual(
				threatEntry2?.shouldExpire,
				true,
				"Player2 in different room should be marked for expiration"
			);
			assert.strictEqual(
				threatEntry3?.shouldExpire,
				false,
				"Player3 in same room should not be marked for expiration"
			);

			// Second expiration cycle - player2 should be reduced, player1 and player3 should not
			(npc as any)._processThreatExpiration();

			const threatEntry1After = npc.threatTable?.get(player1);
			const threatEntry2After = npc.threatTable?.get(player2);
			const threatEntry3After = npc.threatTable?.get(player3);

			assert.strictEqual(
				threatEntry1After?.value,
				200,
				"Player1 in same room threat should not be reduced"
			);
			const expectedValue2 = Math.floor(150 * 0.67); // 100
			assert.strictEqual(
				threatEntry2After?.value,
				expectedValue2,
				"Player2 in different room threat should be reduced"
			);
			assert.strictEqual(
				threatEntry3After?.value,
				300,
				"Player3 in same room threat should not be reduced"
			);
		});

		test("should remove destroyed mobs from threat table", () => {
			npc.damage(player1, 200);
			player1.destroy();

			(npc as any)._processThreatExpiration();

			const threatEntry = npc.threatTable?.get(player1);
			assert.strictEqual(
				threatEntry,
				undefined,
				"Destroyed mob should be removed from threat table"
			);
		});

		test("should stop expiration timer when threat table becomes empty", () => {
			// Move player to different room so threat can expire
			player1.move(room2);
			npc.damage(player1, 100);
			npc.combatTarget = undefined;
			(npc as any)._processThreatExpiration();
			(npc as any)._processThreatExpiration();

			const threatEntry = npc.threatTable!.get(player1);
			assert.strictEqual(
				threatEntry,
				undefined,
				"Expired mob should be removed from threat table"
			);

			const timerAfter = (npc as any)._threatExpirationTimer;
			assert.strictEqual(
				timerAfter,
				undefined,
				"Timer should be stopped when table becomes empty"
			);
		});

		test("should reset shouldExpire flag when threat is added", () => {
			// Move player to different room so threat can expire
			player1.move(room2);
			npc.damage(player1, 200);
			npc.combatTarget = undefined;
			(npc as any)._processThreatExpiration();

			let threatEntry = npc.threatTable?.get(player1);
			assert.strictEqual(
				threatEntry?.shouldExpire,
				true,
				"shouldExpire should be true after first cycle"
			);

			npc.damage(player1, 50);

			threatEntry = npc.threatTable?.get(player1);
			assert.strictEqual(
				threatEntry?.shouldExpire,
				false,
				"shouldExpire should be reset to false when threat is added"
			);
			assert.strictEqual(threatEntry?.value, 250, "Threat should accumulate");
		});
	});

	suite("Threat Table Management", () => {
		test("should clear threat table correctly", () => {
			npc.damage(player1, 100);
			npc.damage(player2, 150);

			assert.ok(npc.threatTable !== undefined, "Threat table should exist");
			assert.strictEqual(
				npc.threatTable.size,
				2,
				"Threat table should have 2 entries"
			);

			npc.clearThreatTable();
			assert.strictEqual(
				npc.threatTable.size,
				0,
				"Threat table should be empty"
			);

			assert.strictEqual(npc.getThreat(player1), 0, "Threat should be cleared");
			assert.strictEqual(npc.getThreat(player2), 0, "Threat should be cleared");
		});

		test("should remove specific mob from threat table", () => {
			npc.damage(player1, 100);
			npc.damage(player2, 150);

			greaterThanOrEqual(
				npc.getThreat(player1),
				100,
				"Player1 should have threat"
			);
			greaterThanOrEqual(
				npc.getThreat(player2),
				150,
				"Player2 should have threat"
			);

			npc.removeThreat(player1);

			assert.strictEqual(
				npc.getThreat(player1),
				0,
				"Player1 threat should be removed"
			);
			assert.strictEqual(
				npc.getThreat(player2),
				150,
				"Player2 threat should remain"
			);
		});

		test("should handle removeThreat when mob not in table", () => {
			npc.removeThreat(player1);

			assert.strictEqual(npc.getThreat(player1), 0);
		});
	});

	suite("Threat Table on Room Entry", () => {
		test.skip("should attack mob with threat when they enter room", () => {
			// Move player1 to room2 first, then deal damage
			player1.move(room2);
			npc.damage(player1, 150);
			assert.ok(npc.combatTarget === undefined, "Should not be in combat yet");

			// Move player1 back to room1, which should trigger threat switching
			player1.move(room1);

			assert.ok(npc.combatTarget !== undefined, "Should have a combat target");
			assert.ok(npc.combatTarget === player1, "Should target player1");
		});
	});
});
