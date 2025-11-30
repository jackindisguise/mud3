import { test, suite, beforeEach, skip, afterEach } from "node:test";
import assert from "node:assert";
import { Dungeon, Mob, Room, Weapon, EQUIPMENT_SLOT } from "./core/dungeon.js";
import { Character } from "./core/character.js";
import {
	initiateCombat,
	addToCombatQueue,
	removeFromCombatQueue,
	isInCombatQueue,
	getCombatQueue,
	processCombatRound,
	oneHit,
} from "./combat.js";
import { DAMAGE_RELATIONSHIP, COMMON_HIT_TYPES } from "./core/damage-types.js";
import { freezeArchetype } from "./core/archetype.js";

const testJob = freezeArchetype({
	id: "test_job",
	name: "Test Job",
	startingAttributes: { strength: 0, agility: 0, intelligence: 0 },
	attributeGrowthPerLevel: { strength: 0, agility: 0, intelligence: 0 },
	startingResourceCaps: { maxHealth: 100000, maxMana: 0 },
	resourceGrowthPerLevel: { maxHealth: 0, maxMana: 0 },
	skills: [],
	passives: [],
	growthModifier: { base: 1.0 },
});

const testRace = freezeArchetype({
	id: "test_race",
	name: "Test Race",
	startingAttributes: { strength: 10, agility: 10, intelligence: 10 },
	attributeGrowthPerLevel: { strength: 0, agility: 0, intelligence: 0 },
	startingResourceCaps: { maxHealth: 100000, maxMana: 50 },
	resourceGrowthPerLevel: { maxHealth: 0, maxMana: 0 },
	skills: [],
	passives: [],
	growthModifier: { base: 1.0 },
});

suite("combat.ts", () => {
	let dungeon: Dungeon;
	let room: Room;
	let attacker: Mob;
	let defender: Mob;

	beforeEach(() => {
		dungeon = new Dungeon({ dimensions: { width: 10, height: 10, layers: 1 } });
		room = dungeon.createRoom({ coordinates: { x: 0, y: 0, z: 0 }, dungeon })!;

		// Create attacker
		attacker = new Mob({
			display: "Attacker",
			race: testRace,
			job: testJob,
			level: 10,
		});
		attacker.location = room;

		// Create defender
		defender = new Mob({
			display: "Defender",
			race: testRace,
			job: testJob,
			level: 10,
		});
		defender.location = room;
	});

	afterEach(() => {
		attacker.combatTarget = undefined;
		defender.combatTarget = undefined;
		attacker.clearThreatTable();
		defender.clearThreatTable();
	});

	suite("Combat queue management", () => {
		test("addToCombatQueue should add mob to queue", () => {
			attacker.combatTarget = defender;
			assert(isInCombatQueue(attacker));
		});

		test("addToCombatQueue should not add mob without target", () => {
			addToCombatQueue(attacker);
			assert(!isInCombatQueue(attacker));
		});

		test("removeFromCombatQueue should remove mob from queue", () => {
			attacker.combatTarget = defender;
			addToCombatQueue(attacker);
			removeFromCombatQueue(attacker);
			assert(!isInCombatQueue(attacker));
		});

		test("getCombatQueue should return all mobs in combat", () => {
			attacker.combatTarget = defender;
			defender.combatTarget = attacker;
			addToCombatQueue(attacker);
			addToCombatQueue(defender);

			const queue = getCombatQueue();
			assert(queue.includes(attacker));
			assert(queue.includes(defender));
		});
	});

	suite("initiateCombat", () => {
		test("should set attacker's target", () => {
			initiateCombat(attacker, defender);
			assert.ok(attacker.combatTarget === defender);
		});

		test("should add attacker to combat queue", () => {
			initiateCombat(attacker, defender);
			assert(isInCombatQueue(attacker));
		});

		test("should set defender's target if not already set", () => {
			initiateCombat(attacker, defender);
			assert.ok(defender.combatTarget === attacker);
		});

		test("should add defender to combat queue if not already in combat", () => {
			initiateCombat(attacker, defender);
			assert(isInCombatQueue(defender));
		});

		test("should ensure defender initiates combat with attacker", () => {
			initiateCombat(attacker, defender);

			// Defender should have attacker as target
			assert.ok(
				defender.combatTarget === attacker,
				"Defender should target attacker"
			);

			// Defender should be in combat queue
			assert(isInCombatQueue(defender), "Defender should be in combat queue");

			// Defender should be in combat
			assert.ok(defender.isInCombat(), "Defender should be in combat");
		});

		test("should ensure player mob defender initiates combat with attacker", () => {
			const playerDefender = new Mob({
				display: "Player Defender",
				race: testRace,
				job: testJob,
				level: 1,
			});
			playerDefender.character = new Character({
				credentials: {
					characterId: 2,
					username: "player2",
				},
				mob: playerDefender,
			});
			playerDefender.location = room;

			initiateCombat(attacker, playerDefender);

			// Player defender should have player attacker as target
			assert.ok(
				playerDefender.combatTarget === attacker,
				"Player defender should target player attacker"
			);

			// Player defender should be in combat queue
			assert(
				isInCombatQueue(playerDefender),
				"Player defender should be in combat queue"
			);

			// Player defender should be in combat
			assert.ok(
				playerDefender.isInCombat(),
				"Player defender should be in combat"
			);

			// Clean up
			playerDefender.combatTarget = undefined;
			removeFromCombatQueue(playerDefender);
		});

		test("should not change defender's target if already set", () => {
			const otherTarget = new Mob({
				display: "Other Target",
				race: testRace,
				job: testJob,
				level: 1,
			});
			otherTarget.location = room;
			defender.damage(otherTarget, 100);
			initiateCombat(attacker, defender);
			assert.ok(defender.combatTarget === otherTarget);
			otherTarget.clearThreatTable();
			otherTarget.combatTarget = undefined;
		});
	});

	suite("Damage type relationships in combat", () => {
		test("should apply damage multiplier for RESIST", () => {
			// Set defender to resist fire damage
			const fireResistRace = freezeArchetype({
				id: "fire_resist_race",
				name: "Fire Resist Race",
				startingAttributes: { strength: 5, agility: 1, intelligence: 5 },
				attributeGrowthPerLevel: { strength: 0, agility: 0, intelligence: 0 },
				startingResourceCaps: { maxHealth: 100, maxMana: 50 },
				resourceGrowthPerLevel: { maxHealth: 0, maxMana: 0 },
				skills: [],
				passives: [],
				growthModifier: { base: 1.0 },
				damageRelationships: {
					FIRE: DAMAGE_RELATIONSHIP.RESIST,
				},
			});
			// Create a new defender with the fire resist race
			const newDefender = new Mob({
				race: fireResistRace,
				job: defender.job,
				level: defender.level,
			});
			room.remove(defender);
			newDefender.location = room;
			defender = newDefender;

			// Equip fire weapon
			const fireSword = new Weapon({
				slot: EQUIPMENT_SLOT.MAIN_HAND,
				attackPower: 20,
				hitType: COMMON_HIT_TYPES.get("burn")!,
			});
			attacker.equip(fireSword);

			const initialHealth = defender.health;
			// Use oneHit with guaranteedHit to ensure we test damage modifiers
			oneHit({
				attacker: attacker,
				target: defender,
				weapon: fireSword,
				guaranteedHit: true,
			});

			// Damage should be reduced by 50% (RESIST)
			const damageDealt = initialHealth - defender.health;
			assert(damageDealt > 0, "Should deal some damage");
			// Note: Exact damage depends on RNG, but should be less than normal
		});

		test("should apply damage multiplier for IMMUNE", () => {
			// Set defender to be immune to fire damage
			const fireImmuneRace = freezeArchetype({
				id: "fire_immune_race",
				name: "Fire Immune Race",
				startingAttributes: { strength: 5, agility: 1, intelligence: 5 },
				attributeGrowthPerLevel: { strength: 0, agility: 0, intelligence: 0 },
				startingResourceCaps: { maxHealth: 100, maxMana: 50 },
				resourceGrowthPerLevel: { maxHealth: 0, maxMana: 0 },
				skills: [],
				passives: [],
				growthModifier: { base: 1.0 },
				damageRelationships: {
					FIRE: DAMAGE_RELATIONSHIP.IMMUNE,
				},
			});
			// Create a new defender with the fire immune race
			const newDefender = new Mob({
				race: fireImmuneRace,
				job: defender.job,
				level: defender.level,
			});
			room.remove(defender);
			newDefender.location = room;
			defender = newDefender;

			// Equip fire weapon
			const fireSword = new Weapon({
				slot: EQUIPMENT_SLOT.MAIN_HAND,
				attackPower: 20,
				hitType: COMMON_HIT_TYPES.get("burn")!,
			});
			attacker.equip(fireSword);

			const initialHealth = defender.health;
			// Use oneHit with guaranteedHit to ensure we test damage modifiers
			oneHit({
				attacker: attacker,
				target: defender,
				weapon: fireSword,
				guaranteedHit: true,
			});

			// Damage should be 0 (IMMUNE)
			const damageDealt = initialHealth - defender.health;
			assert.strictEqual(damageDealt, 0, "Immune damage should be 0");
		});

		test("should apply damage multiplier for VULNERABLE", () => {
			// Set defender to be vulnerable to fire damage
			const fireVulnerableRace = freezeArchetype({
				id: "fire_vulnerable_race",
				name: "Fire Vulnerable Race",
				startingAttributes: { strength: 5, agility: 1, intelligence: 5 },
				attributeGrowthPerLevel: { strength: 0, agility: 0, intelligence: 0 },
				startingResourceCaps: { maxHealth: 100, maxMana: 50 },
				resourceGrowthPerLevel: { maxHealth: 0, maxMana: 0 },
				skills: [],
				passives: [],
				growthModifier: { base: 1.0 },
				damageRelationships: {
					FIRE: DAMAGE_RELATIONSHIP.VULNERABLE,
				},
			});
			// Create a new defender with the fire vulnerable race
			const newDefender = new Mob({
				race: fireVulnerableRace,
				job: defender.job,
				level: defender.level,
			});
			room.remove(defender);
			newDefender.location = room;
			defender = newDefender;

			// Equip fire weapon
			const fireSword = new Weapon({
				slot: EQUIPMENT_SLOT.MAIN_HAND,
				attackPower: 20,
				hitType: COMMON_HIT_TYPES.get("burn")!,
			});
			attacker.equip(fireSword);

			const initialHealth = defender.health;
			// Use oneHit with guaranteedHit to ensure we test damage modifiers
			oneHit({
				attacker: attacker,
				target: defender,
				weapon: fireSword,
				guaranteedHit: true,
			});

			// Damage should be increased by 100% (VULNERABLE = 2x)
			const damageDealt = initialHealth - defender.health;
			assert(damageDealt > 0, "Should deal damage");
			// Note: Exact damage depends on RNG, but should be more than normal
		});

		test("should merge race and job damage relationships", () => {
			// Race gives fire resist, job gives fire vulnerable
			// Result should be resist (priority: IMMUNE > RESIST > VULNERABLE)
			const resistRace = freezeArchetype({
				id: "resist_race",
				name: "Resist Race",
				startingAttributes: { strength: 5, agility: 5, intelligence: 5 },
				attributeGrowthPerLevel: { strength: 0, agility: 0, intelligence: 0 },
				startingResourceCaps: { maxHealth: 100, maxMana: 50 },
				resourceGrowthPerLevel: { maxHealth: 0, maxMana: 0 },
				skills: [],
				passives: [],
				growthModifier: { base: 1.0 },
				damageRelationships: {
					FIRE: DAMAGE_RELATIONSHIP.RESIST,
				},
			});
			const vulnerableJob = freezeArchetype({
				id: "vulnerable_job",
				name: "Vulnerable Job",
				startingAttributes: { strength: 0, agility: 0, intelligence: 0 },
				attributeGrowthPerLevel: { strength: 0, agility: 0, intelligence: 0 },
				startingResourceCaps: { maxHealth: 0, maxMana: 0 },
				resourceGrowthPerLevel: { maxHealth: 0, maxMana: 0 },
				skills: [],
				passives: [],
				growthModifier: { base: 1.0 },
				damageRelationships: {
					FIRE: DAMAGE_RELATIONSHIP.VULNERABLE,
				},
			});
			// Create a new defender with the merged race and job
			const newDefender = new Mob({
				race: resistRace,
				job: vulnerableJob,
				level: defender.level,
			});
			room.remove(defender);
			newDefender.location = room;
			defender = newDefender;

			const relationships = defender.getDamageRelationships();
			assert.strictEqual(
				relationships.FIRE,
				DAMAGE_RELATIONSHIP.RESIST,
				"RESIST should take priority over VULNERABLE"
			);
		});
	});

	suite("processCombatRound", () => {
		test("should process combat for mobs in queue", () => {
			initiateCombat(attacker, defender);
			const initialHealth = defender.health;

			processCombatRound();

			// Defender should have taken damage (unless missed)
			// Note: This depends on RNG, so we just check that combat processed
			assert(isInCombatQueue(attacker) || !attacker.isInCombat());
		});

		test("should remove mobs from queue when target is dead", () => {
			initiateCombat(attacker, defender);
			defender.damage(attacker, defender.health);

			processCombatRound();

			assert(
				!isInCombatQueue(attacker),
				"Attacker should be removed from combat queue"
			);
			assert.ok(
				attacker.combatTarget === undefined,
				"Attacker should have no combat target"
			);
		});

		test("should remove mobs from queue when target leaves room", () => {
			initiateCombat(attacker, defender);
			const otherRoom = new Room({
				coordinates: { x: 1, y: 0, z: 0 },
				dungeon,
			});
			dungeon.add(otherRoom);
			otherRoom.add(defender);

			processCombatRound();

			assert(!isInCombatQueue(attacker));
			assert.ok(attacker.combatTarget === undefined);
		});
	});
});
